package forge.commandtable;

import forge.game.GameView;
import forge.game.card.CardView;
import forge.game.player.PlayerView;
import forge.game.spellability.StackItemView;
import forge.gamemodes.match.Selection;
import forge.trackable.TrackableObject;
import forge.gui.interfaces.IGuiGame;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.Objects;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Intercepts Forge's real UI/game callbacks, leaving gameplay authoritative.
 *
 * Ordinary confirmation, targeting and multi-card choices are presented
 * directly by Command Table. Rare specialized operations temporarily delegate
 * to Forge's view until their interaction model is ported.
 */
public final class CommandTableGuiProxy {
    private CommandTableGuiProxy() {}

    public static IGuiGame wrap(IGuiGame delegate, Supplier<GameView> game,
                                Consumer<GameView> onState, Consumer<Map<String, Object>> onPrompt,
                                Consumer<Map<String, Object>> onSelection,
                                CommandTableChoiceDispatcher choices,
                                Runnable onNativeChoice, Runnable afterNativeChoice) {
        Objects.requireNonNull(delegate, "delegate");
        Objects.requireNonNull(game, "game");
        Objects.requireNonNull(onState, "onState");
        Objects.requireNonNull(onPrompt, "onPrompt");
        Objects.requireNonNull(onSelection, "onSelection");
        Objects.requireNonNull(choices, "choices");
        return (IGuiGame) Proxy.newProxyInstance(
            IGuiGame.class.getClassLoader(),
            new Class<?>[] { IGuiGame.class },
            (object, method, args) -> {
                String name = method.getName();
                Object handled = choices.invoke(method, args);
                if (handled != CommandTableChoiceDispatcher.NOT_HANDLED) {
                    GameView latest = game.get();
                    if (latest != null) onState.accept(latest);
                    return handled;
                }
                boolean blockingChoice = "showConfirmDialog".equals(name)
                    || "showOptionDialog".equals(name) || "showInputDialog".equals(name)
                    || "chooseEntitiesForEffect".equals(name) || "assignCombatDamage".equals(name)
                    || "assignGenericAmount".equals(name) || "manipulateCardList".equals(name)
                    || "getInteger".equals(name) || "confirm".equals(name)
                    || "getAbilityToPlay".equals(name)
                    || "getChoices".equals(name)
                    || "oneOrNone".equals(name) || "one".equals(name)
                    || "many".equals(name) || "order".equals(name)
                    || "insertInList".equals(name)
                    || "chooseSingleEntityForEffect".equals(name)
                    || "reveal".equals(name)
                    || "sideboard".equals(name);
                if (blockingChoice && onNativeChoice != null) onNativeChoice.run();
                Object result;
                try {
                    result = method.invoke(delegate, args);
                } catch (InvocationTargetException ex) {
                    throw ex.getCause();
                } finally {
                    if (blockingChoice && afterNativeChoice != null) afterNativeChoice.run();
                }
                if ("setSelection".equals(name) && args != null && args.length > 0
                        && args[0] instanceof Selection selection) {
                    onSelection.accept(selectionView(selection));
                }
                if ("showPromptMessage".equals(name) && args != null && args.length > 1) {
                    Map<String, Object> prompt = new LinkedHashMap<>();
                    prompt.put("message", String.valueOf(args[1]));
                    onPrompt.accept(prompt);
                }
                if ("updateButtons".equals(name) && args != null && args.length >= 6) {
                    Map<String, Object> prompt = new LinkedHashMap<>();
                    prompt.put("label1", String.valueOf(args[1]));
                    prompt.put("label2", String.valueOf(args[2]));
                    prompt.put("enable1", args[3]);
                    prompt.put("enable2", args[4]);
                    onPrompt.accept(prompt);
                }
                if ("setGameView".equals(name) || "openView".equals(name)
                        || "handleGameEvent".equals(name)
                        || "updateCards".equals(name)
                        || "updateZones".equals(name)
                        || "showCombat".equals(name)) {
                    GameView current = game.get();
                    if (current != null) onState.accept(current);
                }
                return result;
            });
    }
    /** Publish ONLY the objects Forge says this player may select. */
    private static Map<String, Object> selectionView(Selection selection) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("min", selection.min());
        state.put("max", selection.max());
        List<Map<String, Object>> cards = new ArrayList<>();
        for (CardView card : selection.cards()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("kind", "card");
            entry.put("id", card.getId());
            entry.put("label", card.getName());
            cards.add(entry);
        }
        for (CardView card : selection.actionable()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("kind", "card");
            entry.put("id", card.getId());
            entry.put("label", card.getName());
            entry.put("actionable", true);
            cards.add(entry);
        }
        List<Map<String, Object>> targets = new ArrayList<>();
        for (TrackableObject target : selection.targets()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", target.getId());
            if (target instanceof CardView c) {
                entry.put("kind", "card");
                entry.put("label", c.getName());
            } else if (target instanceof PlayerView p) {
                entry.put("kind", "player");
                entry.put("label", p.getLobbyPlayerName());
            } else if (target instanceof StackItemView) {
                entry.put("kind", "stack");
                entry.put("label", target.toString());
            } else {
                continue;
            }
            targets.add(entry);
        }
        state.put("cards", cards);
        state.put("targets", targets);
        List<Integer> chosen = new ArrayList<>();
        for (TrackableObject target : selection.chosen()) chosen.add(target.getId());
        state.put("chosen", chosen);
        return state;
    }

}
