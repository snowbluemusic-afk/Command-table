package forge.commandtable;

import forge.StaticData;
import forge.deck.DeckFormat;
import forge.item.PaperCard;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Validate and repair ONLY bundled starter decks with Forge's own Commander rules.
 * No edits to custom/imported decks, and no cards representing tokens in decklists.
 */
public final class CommandTableStarterDeckRepair {
    private static final String COLOR_ERROR =
        "contains one or more cards that do not match the commanders color identity:";

    private static final List<String> STAPLES = List.of(
        "Mind Stone", "Thought Vessel", "Wayfarer's Bauble", "Swiftfoot Boots",
        "Lightning Greaves", "Solemn Simulacrum", "Guardian Idol", "Everflowing Chalice",
        "Prismatic Lens", "Hedron Archive", "Tome of Legends", "Mazemind Tome",
        "Burnished Hart", "Fellwar Stone", "Arcane Signet", "Sol Ring"
    );

    private CommandTableStarterDeckRepair() {}

    private static List<String> themed(String commander) {
        return switch (commander) {
            case "Giada, Font of Hope" -> List.of(
                "Resplendent Angel", "Righteous Valkyrie", "Angel of Vitality",
                "Inspiring Overseer", "Bishop of Wings", "Dawn of Hope",
                "Youthful Valkyrie", "Angelic Accord", "Starnheim Aspirant");
            case "Krenko, Mob Boss" -> List.of(
                "Goblin Matron", "Skirk Prospector", "Goblin Bombardment",
                "Impact Tremors", "Mogg War Marshal", "Battle Cry Goblin");
            case "Talrand, Sky Summoner" -> List.of(
                "Frantic Search", "Pongify", "Rapid Hybridization",
                "Chart a Course", "Treasure Cruise", "Mystic Sanctuary");
            case "Pantlaza, Sun-Favored" -> List.of(
                "Savage Stomp", "Garruk's Uprising", "Path to Exile",
                "Beast Within", "Forerunner of the Empire", "Descendants' Path");
            case "Vivi Ornitier" -> List.of(
                "Storm-Kiln Artist", "Firemind's Research", "Big Score",
                "Seething Song", "Frantic Search", "Pongify");
            case "Edgar Markov" -> List.of(
                "Cruel Celebrant", "Vampiric Rites", "Indulgent Aristocrat",
                "Viscera Seer", "Falkenrath Noble", "Blood Seeker");
            case "Y'shtola, Night's Blessed" -> List.of(
                "Anguished Unmaking", "Utter End", "Despark",
                "Fracture", "Painful Truths", "Night's Whisper");
            default -> List.of();
        };
    }

    private static Set<String> invalidColorNames(String problem) {
        Set<String> result = new HashSet<>();
        if (problem == null || !problem.startsWith(COLOR_ERROR)) return result;
        for (String line : problem.substring(COLOR_ERROR.length()).split("\\R")) {
            if (!line.isBlank()) result.add(line.strip().toLowerCase(Locale.ROOT));
        }
        return result;
    }

    private static String replacement(String name, PaperCard commander, Set<String> existing) {
        byte identity = commander.getRules().getColorIdentity().getColor();
        List<String> candidates = new ArrayList<>(themed(name));
        candidates.addAll(STAPLES);
        for (String candidateName : candidates) {
            if (existing.contains(candidateName.toLowerCase(Locale.ROOT))) continue;
            PaperCard candidate = StaticData.instance().getCommonCards().getCard(candidateName);
            if (candidate == null) continue;
            if (!candidate.getRules().getColorIdentity().hasNoColorsExcept(identity)) continue;
            if (!DeckFormat.Commander.isLegalCardForCommanderPredicate(
                    List.of(commander)).test(candidate)) continue;
            return candidate.getName();
        }
        // If every curated singleton is used, a basic land is always legal.
        for (String basic : List.of("Plains", "Island", "Swamp", "Mountain", "Forest")) {
            PaperCard land = StaticData.instance().getCommonCards().getCard(basic);
            if (land != null && land.getRules().getColorIdentity().getColor() != 0
                    && land.getRules().getColorIdentity().hasNoColorsExcept(identity))
                return basic;
        }
        return "Wastes";
    }

    public static Map<String, Object> repair(String name, String commanderName,
                                              List<String> main) {
        if (main == null || main.size() != 99)
            throw new IllegalArgumentException("Starter deck requires exactly 99 main cards");
        PaperCard commander = StaticData.instance().getCommonCards().getCard(commanderName);
        if (commander == null)
            throw new IllegalArgumentException("Unknown commander: " + commanderName);

        List<String> cards = new ArrayList<>(main);
        List<Map<String, String>> changes = new ArrayList<>();
        String problem = CommandTableForgeDecks.validationError(
            CommandTableForgeDecks.fromImport(name, commanderName, cards));

        for (int pass = 0; problem != null && pass < 3; pass++) {
            Set<String> illegal = invalidColorNames(problem);
            if (illegal.isEmpty()) break;
            Set<String> names = new HashSet<>();
            for (String n : cards) names.add(n.toLowerCase(Locale.ROOT));
            int repaired = 0;
            for (int i = 0; i < cards.size(); i++) {
                String old = cards.get(i);
                if (!illegal.contains(old.toLowerCase(Locale.ROOT))) continue;
                names.remove(old.toLowerCase(Locale.ROOT));
                String replacement = replacement(commanderName, commander, names);
                cards.set(i, replacement);
                names.add(replacement.toLowerCase(Locale.ROOT));
                Map<String, String> fix = new LinkedHashMap<>();
                fix.put("from", old);
                fix.put("to", replacement);
                changes.add(fix);
                repaired++;
            }
            if (repaired == 0) break;
            problem = CommandTableForgeDecks.validationError(
                CommandTableForgeDecks.fromImport(name, commanderName, cards));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("valid", problem == null);
        result.put("reason", problem == null ? "Legal Commander starter" : problem);
        result.put("main", problem == null ? cards : main);
        result.put("replacements", problem == null ? changes : List.of());
        return result;
    }
}
