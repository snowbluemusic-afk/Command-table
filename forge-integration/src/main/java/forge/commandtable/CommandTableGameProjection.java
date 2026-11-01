package forge.commandtable;

import forge.game.GameView;
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

    public static Map<String, Object> snapshot(GameView game, PlayerView local) {
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
        out.put("gameOver", initialBool(game::isGameOver));
        out.put("winner", game.getWinningPlayerName());

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
            seat.put("battlefield", visibleCards(p.getBattlefield()));
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
            spell.put("name",String.valueOf(item));
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
            attack.put("blockerIds",blockerIds);
            attacks.add(attack);
        }
        out.put("combat",attacks);
        return out;
    }

    private static List<Map<String,Object>> visibleCards(Iterable<CardView> cards) {
        List<Map<String,Object>> result = new ArrayList<>();
        if (cards == null) return result; // The game is still constructing zones.
        for (CardView c : cards) {
            Map<String,Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("name", c.isFaceDown() ? "Face-down card" : c.getOracleName());
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
