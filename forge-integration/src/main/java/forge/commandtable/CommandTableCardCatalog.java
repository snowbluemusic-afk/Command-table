package forge.commandtable;

import forge.StaticData;
import forge.card.CardRules;
import forge.item.PaperCard;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Offline deck-building catalog backed by the same card database as the
 * authoritative Forge rules engine. No Scryfall request is necessary to
 * import a deck, pick a commander, or search legal card names.
 */
public final class CommandTableCardCatalog {
    private CommandTableCardCatalog() {}

    public static List<Map<String, Object>> search(String query,
                                                    boolean commandersOnly,
                                                    int requestedLimit) {
        String term = query == null ? "" : query.strip().toLowerCase(Locale.ROOT);
        if (term.length() < 2) return List.of();
        int limit = Math.min(100, Math.max(1, requestedLimit));
        List<PaperCard> found = new ArrayList<>();
        Set<String> names = new HashSet<>();
        for (PaperCard card : StaticData.instance().getCommonCards().getUniqueCards()) {
            CardRules rules = card.getRules();
            if (rules == null || card.getName() == null) continue;
            if (commandersOnly && !(rules.getType().isLegendary()
                    && rules.getType().isCreature())) continue;
            String normalized = card.getName().toLowerCase(Locale.ROOT);
            if (!normalized.contains(term) || !names.add(normalized)) continue;
            found.add(card);
        }
        found.sort(Comparator
            .comparingInt((PaperCard c) -> c.getName().toLowerCase(Locale.ROOT).startsWith(term) ? 0 : 1)
            .thenComparing(PaperCard::getName, String.CASE_INSENSITIVE_ORDER));
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, found.size()); i++) out.add(details(found.get(i)));
        return out;
    }

    public static List<Map<String, Object>> resolveNames(List<String> names) {
        if (names == null || names.size() > 200)
            throw new IllegalArgumentException("Resolve at most 200 deck cards");
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> unique = new HashSet<>();
        for (String name : names) {
            if (name == null || name.isBlank()) continue;
            if (!unique.add(name.toLowerCase(Locale.ROOT))) continue;
            PaperCard card = StaticData.instance().getCommonCards().getCard(name);
            if (card != null) result.add(details(card));
        }
        return result;
    }

    private static Map<String, Object> details(PaperCard card) {
        CardRules rules = card.getRules();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", card.getName().toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-"));
        out.put("name", card.getName());
        out.put("type", rules.getType().toString());
        out.put("cost", rules.getManaCost().toString()
            .replace("{", "").replace("}", ""));
        out.put("text", rules.getOracleText());
        out.put("power", rules.getPower());
        out.put("toughness", rules.getToughness());
        out.put("implemented", true);
        out.put("effect", "forge");
        out.put("keywords", List.of());
        List<String> colors = new ArrayList<>();
        String identity = rules.getColorIdentity().toString().toUpperCase(Locale.ROOT);
        for (char color : new char[] {'W', 'U', 'B', 'R', 'G'}) {
            if (identity.indexOf(color) >= 0) colors.add(String.valueOf(color));
        }
        out.put("identity", colors);
        out.put("colors", colors);
        return out;
    }
}
