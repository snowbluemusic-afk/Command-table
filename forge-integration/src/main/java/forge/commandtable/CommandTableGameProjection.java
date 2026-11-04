package forge.commandtable;

import forge.game.GameView;
import forge.game.Game;
import forge.game.card.Card;
import forge.game.combat.Combat;
import forge.game.combat.CombatUtil;
import forge.game.player.Player;
import forge.game.combat.CombatView;
import forge.game.GameEntityView;
import forge.game.card.CardView;
import forge.game.player.PlayerView;
import forge.game.spellability.StackItemView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BooleanSupplier;
import java.util.function.IntSupplier;

/**
 * Immutable-by-convention read-only projection from Forge's authoritative GameView.
 * No rules are evaluated here. Hidden opponent hand / library cards are never exposed.
 */
public final class CommandTableGameProjection {
    private CommandTableGameProjection() {}

    /**
     * Forge emits setGameView/openView while constructing the match, before
     * turn and commander properties are populated. Do not acknowledge a
     * match-start request with that half-initialized state.
     */
    public static boolean ready(GameView game) {
        // Forge requires human starting-player and mulligan decisions BEFORE
        // the first turn is chosen. Requiring getPlayerTurn() here deadlocks:
        // the web UI cannot display those buttons until a snapshot exists.
        // The player list is set by Game's constructor and is sufficient to
        // render the pregame board. Other fields may still be uninitialized.
        return game != null && game.getPlayers() != null &&
            game.getPlayers().size() >= 2;
    }

    private static int initialInt(IntSupplier fn, int fallback) {
        try { return fn.getAsInt(); }
        catch (NullPointerException notInitialized) { return fallback; }
    }
    private static boolean initialBool(BooleanSupplier fn) {
        try { return fn.getAsBoolean(); }
        catch (NullPointerException notInitialized) { return false; }
    }

    public static Map<String, Object> snapshot(GameView game, PlayerView local, Game liveGame) {
        if (game == null || local == null) {
            throw new IllegalArgumentException("Game and local player must be supplied");
        }
        Map<String,Object> out = new LinkedHashMap<>();
        out.put("engine", "forge");
        boolean pregame = game.getPlayerTurn() == null;
        out.put("turn", initialInt(game::getTurn, 0));
        out.put("phase", pregame ? "MULLIGAN" : String.valueOf(game.getPhase()));
        out.put("pregame", pregame);
        out.put("activePlayer", game.getPlayerTurn() == null ? null : game.getPlayerTurn().getId());
        out.put("isCommander", game.isCommander());
        // Forge's GameView is the only authority for completion. A negative
        // life total is NOT sufficient: state-based actions and replacement
        // effects must finish before presenting a result.
        boolean gameOver = initialBool(game::isGameOver);
        String winningPlayer = game.getWinningPlayerName();
        out.put("gameOver", gameOver);
        out.put("winner", winningPlayer);
        out.put("outcome", !gameOver ? null
            : winningPlayer == null || winningPlayer.isBlank() ? "draw"
            : winningPlayer.equals(local.getLobbyPlayerName()) ? "victory" : "defeat");

        List<Object> players = new ArrayList<>();
        for (PlayerView p : game.getPlayers()) {
            Map<String,Object> seat = new LinkedHashMap<>();
            seat.put("id", p.getId());
            seat.put("name", p.getLobbyPlayerName());
            seat.put("life", initialInt(p::getLife, 40));
            List<CardView> ownCommanders = p.getCommanders();
            if (ownCommanders != null && !ownCommanders.isEmpty()) {
                CardView commander = ownCommanders.get(0);
                seat.put("commanderName", commander.getOracleName());
                seat.put("commanderCasts", p.getCommanderCast(commander));
            }
            Map<String, Integer> commanderDamage = new LinkedHashMap<>();
            for (PlayerView opponent : game.getPlayers()) {
                List<CardView> commanders = opponent.getCommanders();
                if (commanders == null) continue; // Forge initial view only
                for (CardView commander : commanders) {
                    int damage = p.getCommanderDamage(commander);
                    if (damage > 0) commanderDamage.put(commander.getOracleName(), damage);
                }
            }
            seat.put("commanderDamage", commanderDamage);
            seat.put("landPlays", initialInt(p::getNumLandThisTurn, 0));
            seat.put("isAI", initialBool(p::isAI));
            seat.put("priority", initialBool(p::getHasPriority));
            seat.put("hasLost", initialBool(p::getHasLost));
            seat.put("handCount", p.getHand().size());
            seat.put("libraryCount", p.getLibrary().size());
            seat.put("graveyard", visibleCards(p.getGraveyard()));
            seat.put("exile", visibleCards(p.getExile()));
            List<Map<String,Object>> visibleBoard = visibleCards(p.getBattlefield());
            seat.put("battlefield", visibleBoard);
            // Debugging bridge vs engine: if this rises on Krenko activation,
            // Forge created the tokens and the client is failing to show them.
            seat.put("tokenCount", visibleBoard.stream()
                .filter(card -> Boolean.TRUE.equals(card.get("token"))).count());
            seat.put("commandZone", visibleCards(p.getCommand()));
            if (p.getId() == local.getId()) seat.put("hand", visibleCards(p.getHand()));
            players.add(seat);
        }
        out.put("players", players);
        List<Map<String,Object>> stack = new ArrayList<>();
        Iterable<StackItemView> stackItems =
            game.getStack() == null ? Collections.emptyList() : game.getStack();
        for (StackItemView item : stackItems) {
            Map<String,Object> spell=new LinkedHashMap<>();
            spell.put("id",item.getId());
            // Retain the existing description for older clients, but provide
            // the actual source card and activating player for visual stack UI.
            // An activated or triggered ability is NOT necessarily a cast spell.
            spell.put("name",String.valueOf(item));
            spell.put("description",item.getText());
            spell.put("ability",item.isAbility());
            spell.put("trigger",item.isTrigger());
            CardView source = item.getSourceCard();
            if (source != null) {
                boolean hidden = source.isFaceDown();
                String cardName = hidden ? "Face-down card" : source.getName();
                spell.put("cardName",cardName);
                spell.put("faceDown",hidden);
                if (!hidden && source.getCurrentState() != null) {
                    spell.put("type",String.valueOf(source.getCurrentState().getType()));
                    spell.put("manaCost",String.valueOf(source.getCurrentState().getManaCost()));
                    spell.put("rulesText",source.getCurrentState().getOracleText());
                }
            }
            PlayerView caster = item.getActivatingPlayer();
            if (caster != null) {
                spell.put("controllerId",caster.getId());
                spell.put("controllerName",caster.getLobbyPlayerName());
            }
            // Only targets explicitly exposed by Forge are published.
            // Do not inspect hands, libraries or hidden card identities.
            List<Map<String,Object>> targets = new ArrayList<>();
            if (item.getTargetCards() != null) for (CardView target : item.getTargetCards()) {
                Map<String,Object> entry = new LinkedHashMap<>();
                entry.put("kind","card");
                entry.put("id",target.getId());
                entry.put("name",target.isFaceDown()?"Face-down card":target.getName());
                targets.add(entry);
            }
            if (item.getTargetPlayers() != null) for (PlayerView target : item.getTargetPlayers()) {
                Map<String,Object> entry = new LinkedHashMap<>();
                entry.put("kind","player");
                entry.put("id",target.getId());
                entry.put("name",target.getLobbyPlayerName());
                targets.add(entry);
            }
            if (item.getTargetStackItems() != null) for (StackItemView target : item.getTargetStackItems()) {
                Map<String,Object> entry = new LinkedHashMap<>();
                entry.put("kind","stack");
                entry.put("id",target.getId());
                entry.put("name",target.getSourceCard() != null &&
                    !target.getSourceCard().isFaceDown()
                    ? target.getSourceCard().getName() : "Spell or ability");
                targets.add(entry);
            }
            spell.put("targets",targets);
            stack.add(spell);
        }
        out.put("stack", stack);
        CombatView combat=game.getCombat();
        List<Map<String,Object>> attacks=new ArrayList<>();
        if(combat!=null && combat.getAttackers()!=null)for(CardView attacker : combat.getAttackers()) {
            Map<String,Object> attack=new LinkedHashMap<>();
            attack.put("cardId",attacker.getId());
            attack.put("cardName",attacker.getName());
            GameEntityView defender=combat.getDefender(attacker);
            attack.put("defenderId",defender==null?null:defender.getId());
            List<Integer> blockerIds=new ArrayList<>();
            if(combat.getBlockers(attacker)!=null) {
                for(CardView blocker:combat.getBlockers(attacker)) blockerIds.add(blocker.getId());
            }
            // CardView events are async to the actual InputBlock interaction.
            // During declaration the live Forge Combat map is authoritative;
            // otherwise a successfully assigned block can appear unblocked
            // for multiple snapshots and the UI incorrectly locks itself.
            if(liveGame != null &&
                "COMBAT_DECLARE_BLOCKERS".equals(String.valueOf(game.getPhase()))) {
                try {
                    Combat realCombat=liveGame.getCombat();
                    if(realCombat != null) {
                        for(Card liveAttacker:realCombat.getAttackers()) {
                            if(liveAttacker.getId()!=attacker.getId()) continue;
                            blockerIds.clear();
                            for(Card actual:realCombat.getBlockers(liveAttacker))
                                blockerIds.add(actual.getId());
                            break;
                        }
                    }
                } catch(RuntimeException transition) {
                    // Retain the last published CombatView across a transition.
                }
            }
            attack.put("blockerIds",blockerIds);
            attacks.add(attack);
        }
        out.put("combat",attacks);
        Map<String,Object> candidatesByAttacker = new LinkedHashMap<>();
        boolean candidatesReady = false;
        if(liveGame != null && "COMBAT_DECLARE_BLOCKERS".equals(String.valueOf(game.getPhase()))) {
            try {
                Combat realCombat = liveGame.getCombat();
                Player defender = liveGame.getPlayer(local.getId());
                if(realCombat != null && defender != null) {
                    for(Card attacker : realCombat.getAttackers()) {
                        if(!defender.equals(realCombat.getDefenderPlayerByAttacker(attacker))) continue;
                        List<Integer> legal = new ArrayList<>();
                        for(Card blocker : defender.getCreaturesInPlay()) {
                            if(realCombat.isBlocking(blocker,attacker) ||
                                CombatUtil.canBlock(attacker,blocker,realCombat))
                                legal.add(blocker.getId());
                        }
                        candidatesByAttacker.put(String.valueOf(attacker.getId()),legal);
                    }
                    candidatesReady = true;
                }
            } catch(RuntimeException phaseTransition) {
                candidatesByAttacker.clear();
            }
        }
        out.put("legalBlockers", candidatesByAttacker);
        out.put("legalBlockersReady", candidatesReady);
        return out;
    }

    private static List<Map<String,Object>> visibleCards(Iterable<CardView> cards) {
        List<Map<String,Object>> result = new ArrayList<>();
        if (cards == null) return result; // The game is still constructing zones.
        for (CardView c : cards) {
            Map<String,Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            String displayName = c.getOracleName();
            if (displayName == null || displayName.trim().isEmpty()) {
                displayName = c.getName();
            }
            m.put("name", c.isFaceDown() ? "Face-down card" : displayName);
            m.put("tapped", c.isTapped());
            m.put("attacking", c.isAttacking());
            m.put("blocking", c.isBlocking());
            if (c.getCurrentState() != null && !c.isFaceDown()) {
                m.put("type", String.valueOf(c.getCurrentState().getType()));
                m.put("manaCost", String.valueOf(c.getCurrentState().getManaCost()));
                m.put("rulesText", c.getCurrentState().getOracleText());
                m.put("creature", c.getCurrentState().isCreature());
                m.put("land", c.getCurrentState().isLand());
                m.put("power", c.getCurrentState().getPower());
                m.put("toughness", c.getCurrentState().getToughness());
            }
            m.put("token", c.isToken());
            m.put("commander", c.isCommander());
            m.put("faceDown", c.isFaceDown());
            result.add(m);
        }
        return result;
    }
}
