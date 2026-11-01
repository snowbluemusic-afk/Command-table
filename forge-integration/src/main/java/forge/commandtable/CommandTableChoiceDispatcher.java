package forge.commandtable;

import forge.game.card.CardView;
import forge.game.player.PlayerView;
import forge.gui.interfaces.IGuiGame;
import forge.util.FSerializableFunction;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Turns Forge's synchronous human decisions into user-facing Command Table
 * choices. Options retain their original Forge object references; the browser
 * only returns indices, so it can never fabricate a card or legal target.
 *
 * The Forge game thread waits for a human response, never an AI approximation.
 * Generic modal choices, commander casting options, numeric values and ordering
 * are supported without displaying Forge's legacy UI.
 */
public final class CommandTableChoiceDispatcher {
    public static final Object NOT_HANDLED = new Object();
    private final AtomicLong sequence = new AtomicLong();
    private final Consumer<Map<String, Object>> publish;
    private final ConcurrentHashMap<String, Pending> pending = new ConcurrentHashMap<>();
    private volatile Map<String, Object> lastEvent;

    private static final class Pending {
        final List<?> original;
        final CompletableFuture<Response> result = new CompletableFuture<>();
        final int min;
        final int max;
        final String mode;
        final int requiredTotal;
        final int minEach;

        Pending(List<?> original, int min, int max, String mode,
                int requiredTotal, int minEach) {
            this.original = original;
            this.min = min;
            this.max = max;
            this.mode = mode;
            this.requiredTotal = requiredTotal;
            this.minEach = minEach;
        }
    }

    public record Response(List<Integer> indices, String text, boolean cancelled,
                           boolean remember, Map<Integer, Integer> allocation) {}

    public CommandTableChoiceDispatcher(Consumer<Map<String, Object>> publish) {
        this.publish = publish;
    }

    private static String text(Object x) {
        if (x instanceof CardView card) return card.getName();
        if (x instanceof PlayerView player) return player.getLobbyPlayerName();
        return String.valueOf(x);
    }

    private static String description(Object x, Object formatter) {
        if (formatter instanceof FSerializableFunction<?, ?> fn) {
            try {
                @SuppressWarnings("unchecked")
                FSerializableFunction<Object, ?> display = (FSerializableFunction<Object, ?>) fn;
                Object result = display.apply(x);
                if (result != null) return String.valueOf(result);
            } catch (Exception ignored) {
                // A cosmetic display mapper must not break a legal Forge choice.
            }
        }
        return text(x);
    }

    private static List<?> list(Object value) {
        if (value == null) return Collections.emptyList();
        if (value instanceof List<?> found) return found;
        if (value instanceof Iterable<?> iterable) {
            List<Object> copy = new ArrayList<>();
            for (Object x : iterable) copy.add(x);
            return copy;
        }
        throw new IllegalArgumentException("Expected a Forge selection list");
    }

    private static int number(Object value, int fallback) {
        return value instanceof Number n ? n.intValue() : fallback;
    }

    private Response waitFor(String mode, String title, List<?> options,
                             int minimum, int maximum, Object display,
                             Map<String, Object> extras) {
        String id = "choice-" + sequence.incrementAndGet();
        int min = Math.max(0, minimum);
        int max = maximum < 0 ? options.size() : Math.max(min, maximum);
        int total = extras == null ? 0 : number(extras.get("amount"), 0);
        int minimumEach = extras == null ? 0 : number(extras.get("minEach"), 0);
        Pending ticket = new Pending(options, min, max, mode, total, minimumEach);
        pending.put(id, ticket);

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", id);
        event.put("mode", mode);
        event.put("title", title == null ? "Make a choice" : title);
        event.put("min", min);
        event.put("max", max);
        List<Map<String, Object>> entries = new ArrayList<>();
        for (int i = 0; i < options.size(); i++) {
            Object value = options.get(i);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("index", i);
            entry.put("label", description(value, display));
            if (value instanceof CardView card) entry.put("cardId", card.getId());
            if (value instanceof PlayerView player) entry.put("playerId", player.getId());
            entries.add(entry);
        }
        event.put("options", entries);
        if (extras != null) event.putAll(extras);
        lastEvent=event;
        try {
            publish.accept(event);
            return ticket.result.get();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Forge player choice interrupted", interrupted);
        } catch (ExecutionException failure) {
            throw new IllegalStateException("Forge player choice cancelled", failure.getCause());
        } finally {
            pending.remove(id);
            if (lastEvent == event) lastEvent=null;
        }
    }

    public boolean answer(String id, List<Integer> indices, String typed,
                          boolean cancelled, boolean remember,
                          Map<Integer, Integer> allocation) {
        Pending ticket = pending.get(id);
        if (ticket == null) return false;
        List<Integer> selected = indices == null ? List.of() : List.copyOf(indices);
        Set<Integer> unique = new LinkedHashSet<>(selected);
        if (unique.size() != selected.size()) throw new IllegalArgumentException("Duplicate choice index");
        for (Integer i : selected) {
            if (i == null || i < 0 || i >= ticket.original.size())
                throw new IllegalArgumentException("Unknown Forge choice index");
        }
        if (!cancelled && !"text".equals(ticket.mode) && !"integer".equals(ticket.mode)
                && selected.size() < ticket.min)
            throw new IllegalArgumentException("Select at least " + ticket.min);
        if (!cancelled && selected.size() > ticket.max)
            throw new IllegalArgumentException("Select at most " + ticket.max);
        Map<Integer, Integer> assigned = allocation == null ? Map.of() : Map.copyOf(allocation);
        if (!cancelled && "allocation".equals(ticket.mode)) {
            int assignedTotal = 0;
            for (int i = 0; i < ticket.original.size(); i++) {
                int amount = assigned.getOrDefault(i, 0);
                if (amount < ticket.minEach || amount > ticket.requiredTotal)
                    throw new IllegalArgumentException("Allocation outside legal range");
                assignedTotal += amount;
            }
            for (Integer index : assigned.keySet()) {
                if (index == null || index < 0 || index >= ticket.original.size())
                    throw new IllegalArgumentException("Unknown allocation target");
            }
            if (assignedTotal != ticket.requiredTotal)
                throw new IllegalArgumentException("Assign exactly " + ticket.requiredTotal);
        }
        return ticket.result.complete(new Response(selected, typed, cancelled, remember, assigned));
    }

    /** Replay the current unanswered Forge choice when the Android view returns. */
    public void replayPending() {
        Map<String,Object> event=lastEvent;
        if(event!=null && pending.containsKey(String.valueOf(event.get("id"))))
            publish.accept(event);
    }

    public void cancelAll() {
        lastEvent=null;
        for (Pending p : pending.values()) {
            p.result.completeExceptionally(new IllegalStateException("Match ended"));
        }
        pending.clear();
    }

    private static <T> List<T> chosen(List<T> options, Response response) {
        if (response.cancelled()) return Collections.emptyList();
        List<T> result = new ArrayList<>();
        for (int index : response.indices()) result.add(options.get(index));
        return result;
    }

    @SuppressWarnings("unchecked")
    private Object choose(String mode, String title, List<?> options, int min, int max,
                          Object display, Map<String, Object> extra) {
        Response response = waitFor(mode, title, options, min, max, display, extra);
        List<Object> picked = chosen((List<Object>) options, response);
        if ("single".equals(mode)) return picked.isEmpty() ? null : picked.get(0);
        if ("order".equals(mode)) return picked;
        return picked;
    }

    /**
     * @return A genuine Forge object (or list), or NOT_HANDLED to delegate the
     * rare game-specific UI operations not yet modeled by the choice sheet.
     */
    @SuppressWarnings("unchecked")
    public Object invoke(Method method, Object[] args) {
        String action = method.getName();
        Object[] a = args == null ? new Object[0] : args;
        switch (action) {
            case "showConfirmDialog": {
                String title = a.length > 1 ? text(a[1]) : "Confirm";
                List<String> buttons = new ArrayList<>();
                buttons.add(a.length > 2 ? text(a[2]) : "Yes");
                buttons.add(a.length > 3 ? text(a[3]) : "No");
                Object picked = choose("single", title + "\n" + text(a[0]), buttons,
                                       1, 1, null, Map.of("confirm", true));
                return picked != null && picked.equals(buttons.get(0));
            }
            case "confirm": {
                String question = a.length > 1 ? text(a[1]) : "Confirm";
                List<?> buttons = a.length > 3 ? list(a[3]) : List.of("Yes", "No");
                Object picked = choose("single", question, buttons, 1, 1, null, Map.of("confirm", true));
                return picked != null && picked.equals(buttons.get(0));
            }
            case "showOptionDialog": {
                List<?> options = list(a[3]);
                Response result = waitFor("single", text(a[1]) + "\n" + text(a[0]),
                                          options, 1, 1, null, Map.of());
                return result.indices().isEmpty() ? -1 : result.indices().get(0);
            }
            case "showInputDialog": {
                Map<String, Object> extra = new LinkedHashMap<>();
                extra.put("initial", a.length > 3 && a[3] != null ? text(a[3]) : "");
                extra.put("numeric", a.length > 5 && Boolean.TRUE.equals(a[5]));
                Response result = waitFor("text", text(a[1]) + "\n" + text(a[0]),
                                          a.length > 4 ? list(a[4]) : List.of(),
                                          0, 1, null, extra);
                return result.cancelled() ? null : result.text();
            }
            case "getInteger": {
                int min = number(a[1], 0), max = number(a[2], 0);
                if (max < min) throw new IllegalArgumentException("Forge integer bounds invalid");
                Map<String, Object> extra = Map.of("minValue", min, "maxValue", max, "initial", min);
                Response result = waitFor("integer", text(a[0]), List.of(), 0, 0, null, extra);
                if (result.cancelled()) return null;
                int n = Integer.parseInt(result.text());
                if (n < min || n > max) throw new IllegalArgumentException("Integer outside Forge range");
                return n;
            }
            case "one":
            case "oneOrNone": {
                List<?> options = list(a[1]);
                if (options.isEmpty()) return null;
                int min = "oneOrNone".equals(action) ? 0 : 1;
                return choose("single", text(a[0]), options, min, 1,
                              a.length > 2 ? a[2] : null, Map.of());
            }
            case "getChoices": {
                List<?> options = list(a[3]);
                int min = number(a[1], 0), max = number(a[2], options.size());
                return choose("multiple", text(a[0]), options, min, max,
                              a.length > 5 ? a[5] : null, Map.of());
            }
            case "many": {
                if (a.length < 5) return NOT_HANDLED;
                boolean full = a.length == 7;
                int min = number(a[2], 0);
                int max = full ? number(a[3], min) : a.length == 6 ? number(a[3], min) : min;
                List<?> options = list(a[full || a.length == 6 ? 4 : 3]);
                return choose("multiple", text(a[0]) + "\n" + text(a[1]),
                              options, min, max, null, Map.of());
            }
            case "chooseSingleEntityForEffect": {
                List<?> options = list(a[1]);
                int min = Boolean.TRUE.equals(a[3]) ? 0 : 1;
                return choose("single", text(a[0]), options, min, 1, null, Map.of());
            }
            case "chooseEntitiesForEffect": {
                List<?> options = list(a[1]);
                return choose("multiple", text(a[0]), options,
                              number(a[2], 0), number(a[3], options.size()), null, Map.of());
            }
            case "getAbilityToPlay": {
                List<?> abilities = list(a[1]);
                if (abilities.size() == 1) return abilities.get(0);
                return choose("single", "Choose an ability for " + text(a[0]),
                              abilities, 1, 1, null, Map.of());
            }
            case "order": {
                List<?> options = a.length == 4 ? list(a[2]) : list(a[4]);
                Map<String, Object> extra = Map.of("ordering", true);
                Object values = choose("order", text(a[0]) + "\n" + text(a[1]),
                                       options, options.size(), options.size(), null, extra);
                if (a.length >= 9) {
                    return new IGuiGame.OrderResult<>((List<?>) values, false);
                }
                return values;
            }
            case "assignCombatDamage": {
                List<Object> targets = new ArrayList<>(list(a[1]));
                int damage = number(a[2], 0);
                if (a[0] instanceof CardView attacker && a[3] != null
                        && attacker.getCurrentState() != null
                        && (attacker.getCurrentState().hasTrample()
                            || attacker.getCurrentState().hasDivideDamage())) {
                    targets.add(null); // Null key is combat damage assigned to the defender.
                }
                if (targets.isEmpty()) return Map.of();
                Map<String, Object> extras = new LinkedHashMap<>();
                extras.put("amount", damage);
                extras.put("minEach", 0);
                extras.put("unit", "combat damage");
                extras.put("allowSkip", Boolean.TRUE.equals(a[5]));
                Response result = waitFor("allocation", "Assign " + damage + " combat damage from "
                        + text(a[0]), targets, 0, targets.size(), null, extras);
                if (result.cancelled()) return Boolean.TRUE.equals(a[5]) ? null : Map.of();
                Map<Object, Integer> values = new LinkedHashMap<>();
                for (int i = 0; i < targets.size(); i++)
                    values.put(targets.get(i), result.allocation().getOrDefault(i, 0));
                return values;
            }
            case "assignGenericAmount": {
                @SuppressWarnings("unchecked")
                Map<Object, Integer> target = (Map<Object, Integer>) a[1];
                List<Object> options = new ArrayList<>(target.keySet());
                int total = number(a[2], 0);
                int minEach = Boolean.TRUE.equals(a[3]) ? 1 : 0;
                Map<String, Object> extras = new LinkedHashMap<>();
                extras.put("amount", total);
                extras.put("minEach", minEach);
                extras.put("unit", text(a[4]));
                Response result = waitFor("allocation", "Distribute " + total + " "
                    + text(a[4]), options, 0, options.size(), null, extras);
                Map<Object, Integer> allocated = new LinkedHashMap<>();
                for (int i = 0; i < options.size(); i++)
                    allocated.put(options.get(i), result.allocation().getOrDefault(i, 0));
                return allocated;
            }
            case "manipulateCardList": {
                List<?> options = list(a[1]);
                return choose("order", text(a[0]), options, options.size(), options.size(),
                    null, Map.of("ordering", true));
            }
            case "insertInList": {
                List<Object> options = new ArrayList<>();
                options.add(a[1]);
                options.addAll(list(a[2]));
                return choose("order", text(a[0]), options, options.size(),
                              options.size(), null, Map.of("ordering", true));
            }
            default:
                return NOT_HANDLED;
        }
    }
}
