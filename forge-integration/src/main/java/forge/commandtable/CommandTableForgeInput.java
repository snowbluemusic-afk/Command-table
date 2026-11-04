package forge.commandtable;

import forge.game.GameView;
import forge.game.card.CardView;
import forge.game.player.PlayerView;
import forge.game.spellability.StackItemView;
import forge.gamemodes.match.HostedMatch;
import forge.gamemodes.match.input.InputPassPriority;
import forge.gamemodes.match.input.InputLondonMulligan;
import forge.gamemodes.match.input.InputBlock;
import forge.gui.FThreads;
import forge.player.PlayerControllerHuman;

import java.util.Collections;
import java.util.Objects;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

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

    /**
     * Forge Mobile's GuiMobile.invokeInEdtAndWait uses WaitRunnable, whose
     * notify()/wait() sequence can lose the signal when the GL runnable
     * finishes before the requesting thread enters wait(). That leaves the
     * game.command worker blocked indefinitely, even for zero blockers.
     *
     * Use an actual latch instead. An operation not yet started when the
     * deadline expires is discarded, so it cannot apply a stale click later.
     * An already-running operation is never replayed: the UI must refresh
     * Forge's authoritative state before another attempt.
     */
    private static void runOnForgeUi(Runnable operation) {
        if (FThreads.isGuiThread()) {
            operation.run();
            return;
        }
        final CountDownLatch completed = new CountDownLatch(1);
        final AtomicInteger state = new AtomicInteger(0); // 0 queued, 1 running, 2 expired, 3 completed
        final AtomicReference<Throwable> failure = new AtomicReference<>();
        FThreads.invokeInEdtLater(() -> {
            if (!state.compareAndSet(0, 1)) {
                completed.countDown(); // expired before the UI thread reached it
                return;
            }
            try {
                operation.run();
            } catch (Throwable error) {
                failure.set(error);
            } finally {
                state.set(3);
                completed.countDown();
            }
        });
        try {
            if (!completed.await(8, TimeUnit.SECONDS)) {
                boolean cancelledBeforeRun = state.compareAndSet(0, 2);
                throw new IllegalStateException(cancelledBeforeRun
                    ? "The Sol Pod UI thread did not process this input; it was cancelled. Refresh the game."
                    : "The Sol Pod UI input is still processing. Refresh the game before retrying.");
            }
        } catch (InterruptedException interrupted) {
            state.compareAndSet(0, 2);
            Thread.currentThread().interrupt();
            throw new IllegalStateException(
                "Sol Pod input interrupted; refresh the game before retrying.", interrupted);
        }
        Throwable error = failure.get();
        if (error instanceof RuntimeException runtime) throw runtime;
        if (error instanceof Error fatal) throw fatal;
        if (error != null) throw new IllegalStateException("Sol Pod input failed", error);
    }

    public void confirm() {
        runOnForgeUi(() -> human().selectButtonOk());
    }
    /**
     * A late blocker confirmation must not consume priority or advance a
     * different prompt after Forge has already left the blocker step.
     */
    public void confirmBlocks() {
        runOnForgeUi(() -> {
            requirePhase("COMBAT_DECLARE_BLOCKERS");
            if (!(human().getInputProxy().getInput() instanceof InputBlock))
                throw new IllegalStateException("There is no active blocker choice. Refresh combat.");
            human().selectButtonOk();
        });
    }
    public void cancel() {
        // The Forge GL/EDT may currently be busy resolving an ability or
        // waiting for a mana/target decision. Do not block the WebView's
        // cancellation request behind the same thread and time out again.
        // This ACK means cancellation was REQUESTED, not that Forge has
        // completed it. Sol Pod must verify the live state afterwards.
        FThreads.invokeInEdtNowOrLater(() -> human().selectButtonCancel());
    }
    public void concede() {
        runOnForgeUi(() -> human().concede());
    }
    public void selectCard(int cardId) {
        runOnForgeUi(() -> {
            CardView card = findCard(cardId);
            if (card == null) throw new IllegalArgumentException("Card not visible to player: " + cardId);
            human().selectCard(card, Collections.emptyList(), null);
        });
    }
    /**
     * Forge InputLondonMulligan.getSelection() deliberately publishes only
     * the ALREADY CHOSEN cards, not the selectable hand. Therefore the normal
     * Selection-based picker cannot display any unchosen candidates.
     * Expose a dedicated, strictly guarded tap for this specific input.
     * Forge still owns the count, toggle, ordering and actual zone change.
     */
    public void chooseMulliganBottomCard(int cardId) {
        runOnForgeUi(() -> {
            final var current = human().getInputProxy().getInput();
            if (!(current instanceof InputLondonMulligan)) {
                throw new IllegalStateException(
                    "Sol Pod is no longer asking you to put mulligan cards on the bottom");
            }
            CardView selected = null;
            for (CardView card : view().getPlayers().get(0).getHand()) {
                if (card.getId() == cardId) { selected = card; break; }
            }
            if (selected == null) {
                throw new IllegalArgumentException("Selected card is not in your current hand");
            }
            if (!human().selectCard(selected, Collections.emptyList(), null)) {
                throw new IllegalStateException("Sol Pod rejected this mulligan card selection");
            }
        });
    }

    /**
     * A Cast button must not report success if Forge rejected its selected
     * card. InputPassPriority owns timing and all spell/land permissions.
     */
    public void castCard(int cardId) {
        runOnForgeUi(() -> {
            CardView card = findCard(cardId);
            if (card == null)
                throw new IllegalArgumentException("That card has moved out of your hand or command zone");

            // A card may be visible while Forge expects mulligan, mana,
            // target, combat or the opponent's priority. Only the current
            // priority input is authorized to start a new spell/land play.
            final var current = human().getInputProxy().getInput();
            if (!(current instanceof InputPassPriority priority))
                throw new IllegalStateException(
                    "You cannot cast yet. Sol Pod is waiting for " +
                    (current == null ? "a game decision" :
                        current.getClass().getSimpleName().replace("Input", "")));

            if (!human().selectCard(card, Collections.emptyList(), null))
                throw new IllegalStateException(
                    "Sol Pod rejected this card. Check available mana, your turn and spell timing.");

            // Forge InputPassPriority intentionally returns true even when
            // the ability picker was cancelled. Avoid an erroneous success.
            final var chosen = priority.getChosenSa();
            if (chosen == null || chosen.isEmpty())
                throw new IllegalStateException(
                    "No spell or land play was selected. Sol Pod has not cast this card.");
        });
    }

    public void selectPlayer(int playerId) {
        runOnForgeUi(() -> {
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
    /**
     * Forge InputAttack requires defender BEFORE creature. A single UI gesture
     * should select only that attacker, not invoke its Alpha Strike shortcut.
     */
    public void attackWith(int attackerId, int defenderId) {
        runOnForgeUi(() -> {
            requirePhase("COMBAT_DECLARE_ATTACKERS");
            PlayerView defender = findPlayer(defenderId);
            if (defender == null || defender == view().getPlayers().get(0))
                throw new IllegalArgumentException("Choose an opposing defending player");
            CardView attacker = findCard(attackerId);
            if (attacker == null)
                throw new IllegalArgumentException("Attacking creature is not on the battlefield");
            human().selectPlayer(defender, null);
            if (!human().selectCard(attacker, Collections.emptyList(), null))
                throw new IllegalArgumentException("Sol Pod rejected this attacker");
        });
    }

    /**
     * Forge InputBlock requires the incoming attacker BEFORE the blocker.
     * This permits different defenders for each attack and multiple blocks.
     */
    public void blockWith(int attackerId, int blockerId) {
        runOnForgeUi(() -> {
            requirePhase("COMBAT_DECLARE_BLOCKERS");
            CardView attacker = findCard(attackerId);
            CardView blocker = findCard(blockerId);
            if (attacker == null || blocker == null)
                throw new IllegalArgumentException("The attacker or blocker is no longer visible");
            if (!human().selectCard(attacker, Collections.emptyList(), null))
                throw new IllegalArgumentException("Sol Pod rejected the selected attacker");
            if (!human().selectCard(blocker, Collections.emptyList(), null))
                throw new IllegalArgumentException("Sol Pod rejected the blocker assignment");
        });
    }

    private void requirePhase(String expected) {
        if (!expected.equals(String.valueOf(view().getPhase())))
            throw new IllegalStateException("Combat step changed before your selection");
    }
    private PlayerView findPlayer(int playerId) {
        for (PlayerView p : view().getPlayers()) if (p.getId()==playerId) return p;
        return null;
    }

    public void selectStack(int stackId) {
        runOnForgeUi(() -> {
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
            throw new IllegalStateException("No Sol Pod human player controller");
        return match.getHumanControllers().get(0);
    }
    private GameView view() {
        GameView view=match.getGameView();
        if (view==null) throw new IllegalStateException("No active Sol Pod game");
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
