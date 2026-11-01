package forge.commandtable;

import forge.game.GameView;
import forge.game.card.CardView;
import forge.game.player.PlayerView;
import forge.game.spellability.StackItemView;
import forge.gamemodes.match.HostedMatch;
import forge.gui.FThreads;
import forge.player.PlayerControllerHuman;

import java.util.Collections;
import java.util.Objects;

/**
 * Routes Command Table taps to Forge's own human controller. No spell
 * or mana rules are calculated in JavaScript.
 *
 * Only low-level selections are exposed here. Targeting and complex prompt
 * flows still require the full IGuiGame choice/prompt adapter.
 */
public final class CommandTableForgeInput {
    private final HostedMatch match;

    public CommandTableForgeInput(HostedMatch match) {
        this.match = Objects.requireNonNull(match);
    }

    public void confirm() {
        FThreads.invokeInEdtAndWait(() -> human().selectButtonOk());
    }
    public void cancel() {
        FThreads.invokeInEdtAndWait(() -> human().selectButtonCancel());
    }
    public void concede() {
        FThreads.invokeInEdtAndWait(() -> human().concede());
    }
    public void selectCard(int cardId) {
        FThreads.invokeInEdtAndWait(() -> {
            CardView card = findCard(cardId);
            if (card == null) throw new IllegalArgumentException("Card not visible to player: " + cardId);
            human().selectCard(card, Collections.emptyList(), null);
        });
    }
    public void selectPlayer(int playerId) {
        FThreads.invokeInEdtAndWait(() -> {
            GameView view = view();
            for (PlayerView p : view.getPlayers()) {
                if (p.getId() == playerId) {
                    human().selectPlayer(p, null);
                    return;
                }
            }
            throw new IllegalArgumentException("Player not found: " + playerId);
        });
    }
    public void selectStack(int stackId) {
        FThreads.invokeInEdtAndWait(() -> {
            for (StackItemView item : view().getStack()) {
                if (item.getId() == stackId) {
                    human().selectStackItem(item);
                    return;
                }
            }
            throw new IllegalArgumentException("Stack entry not found: " + stackId);
        });
    }

    private PlayerControllerHuman human() {
        if (match.getHumanControllers().isEmpty())
            throw new IllegalStateException("No Forge human player controller");
        return match.getHumanControllers().get(0);
    }
    private GameView view() {
        GameView view=match.getGameView();
        if (view==null) throw new IllegalStateException("No active Forge game");
        return view;
    }
    private CardView findCard(int id) {
        GameView game=view();
        for (PlayerView p: game.getPlayers()) {
            CardView card=scan(p.getBattlefield(),id);
            if(card!=null)return card;
            card=scan(p.getCommand(),id);
            if(card!=null)return card;
            card=scan(p.getGraveyard(),id);
            if(card!=null)return card;
            card=scan(p.getExile(),id);
            if(card!=null)return card;
        }
        if(!game.getPlayers().isEmpty()) {
            CardView handCard=scan(game.getPlayers().get(0).getHand(),id);
            if(handCard!=null)return handCard;
        }
        return null;
    }
    private CardView scan(Iterable<CardView> cards,int id){
        for(CardView c:cards)if(c.getId()==id)return c;
        return null;
    }
}
