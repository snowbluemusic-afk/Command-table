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
                                Consumer<String> onNotice,
                                CommandTableChoiceDispatcher choices,
                                Runnable onNativeChoice, Runnable afterNativeChoice) {
        Objects.requireNonNull(delegate, "delegate");
        Objects.requireNonNull(game, "game");
        Objects.requireNonNull(onState, "onState");
        Objects.requireNonNull(onPrompt, "onPrompt");
        Objects.requireNonNull(onSelection, "onSelection");
        Objects.requireNonNull(onNotice, "onNotice");
        Objects.requireNonNull(choices, "choices");
        return (IGuiGame) Proxy.newProxyInstance(
            IGuiGame.class.getClassLoader(),
            new Class<?>[] { IGuiGame.class },
            (object, method, args) -> {
                String name = method.getName();
                // Native Forge may remain initialized for controller bookkeeping,
                // but it must never own Command Table's visible game or popups.
                if ("message".equals(name) || "showErrorDialog".equals(name)) {
                    if (args != null && args.length > 0 && args[0] != null)
                        onNotice.accept(String.valueOf(args[0]));
                    return null;
                }
                if ("reveal".equals(name) || "showRevealedCards".equals(name)) {
                    String title = args != null && args.length > 0 ? String.valueOf(args[0]) : "Cards revealed";
                    Object list = args != null && args.length > 1 ? args[1] :
                                  args != null && args.length > 0 ? args[0] : null;
                    StringBuilder info = new StringBuilder(title).append(": ");
                    if (list instanceof Iterable<?> iterable) {
                        int count=0;
                        for (Object card : iterable) {
                            if (count++ > 0) info.append(", ");
                            info.append(String.valueOf(card));
                            if (count >= 15) {info.append(" …");break;}
                        }
                    }
                    onNotice.accept(info.toString());
                    return null;
                }
                if ("flashIncorrectAction".equals(name) || "alertUser".equals(name))
                    return null;
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
                    || "sideboard".equals(name);
                if (blockingChoice) {
                    onNotice.accept("Forge needs a choice Command Table cannot yet display: " + name);
                    throw new UnsupportedOperationException(
                        "Missing Command Table Forge choice handler: " + name);
                }
                Object result;
                try {
                    result = method.invoke(delegate, args);
                } catch (InvocationTargetException ex) {
                    throw ex.getCause();
                } finally {
                    if ("openView".equals(name) && afterNativeChoice != null) {
                        // Forge builds controller state here. Keep the WebView on
                        // top *after* the native match surface has been created.
                        afterNativeChoice.run();
                    }
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
                if ("updateButtons".equals(name) && args != null) {
                    // Forge has BOTH a four-argument default overload and a
                    // six-argument labelled overload. The default calls the
                    // delegate's own method, bypassing this proxy otherwise.
                    // Missing this is fatal during starting-player/mulligan:
                    // native buttons are hidden behind our WebView.
                    Map<String, Object> prompt = new LinkedHashMap<>();
                    if (args.length >= 6) {
                        prompt.put("label1", String.valueOf(args[1]));
                        prompt.put("label2", String.valueOf(args[2]));
                        prompt.put("enable1", Boolean.TRUE.equals(args[3]));
                        prompt.put("enable2", Boolean.TRUE.equals(args[4]));
                    } else if (args.length == 4) {
                        prompt.put("label1", "OK");
                        prompt.put("label2", "Cancel");
                        prompt.put("enable1", Boolean.TRUE.equals(args[1]));
                        prompt.put("enable2", Boolean.TRUE.equals(args[2]));
                    }
                    if (!prompt.isEmpty()) onPrompt.accept(prompt);
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
