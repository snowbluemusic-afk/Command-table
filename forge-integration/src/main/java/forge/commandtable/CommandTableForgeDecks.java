package forge.commandtable;

import forge.StaticData;
import forge.item.PaperCard;
import forge.deck.CardPool;
import forge.deck.Deck;
import forge.deck.DeckFormat;
import forge.deck.DeckSection;
import java.util.List;

/**
 * Converts user-imported Commander decks into Forge card objects.
 * All legality and card resolution come from upstream Forge's card database.
 * Call only after Forge StaticData initialization.
 */
public final class CommandTableForgeDecks {
    private CommandTableForgeDecks() {}

    /** Canonicalise punctuation from exports and old bundled starter decks.
     * Forge card IDs use the printed name (straight apostrophe), while the
     * earlier Command Table sample database used typographic apostrophes.
     * Keep unresolved names for Forge's descriptive validation errors.
     */
    public static String canonicalName(String name) {
        if (name == null) return "";
        String normalized = name.strip()
            .replace('\u2018', '\'')
            .replace('\u2019', '\'')
            .replace('\u02bc', '\'')
            .replace('\uff07', '\'')
            .replace('\u00a0', ' ')
            .replace('\u2010', '-')
            .replace('\u2011', '-')
            .replace('\u2013', '-');
        try {
            PaperCard resolved = StaticData.instance().getCommonCards().getCard(normalized);
            if (resolved != null) return resolved.getName();
        } catch (Exception ignored) { // Forge may be initializing card data
        }
        return normalized;
    }

    public static Deck fromImport(String name, String commander, List<String> main) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Deck needs a name");
        if (commander == null || commander.isBlank()) throw new IllegalArgumentException("Choose a commander");
        if (main == null || main.size() != 99) {
            throw new IllegalArgumentException("Commander requires 99 cards in the main deck");
        }
        Deck deck = new Deck(name);
        deck.getOrCreate(DeckSection.Commander).add(canonicalName(commander), 1);
        CardPool pool = deck.getMain();
        for (String card : main) {
            if (card == null || card.isBlank()) throw new IllegalArgumentException("Blank card name");
            pool.add(canonicalName(card), 1);
        }
        return deck;
    }

    public static String validationError(Deck deck) {
        return DeckFormat.Commander.getDeckConformanceProblem(deck);
    }

    public static Deck validated(String name, String commander, List<String> main) {
        Deck deck = fromImport(name, commander, main);
        String error = validationError(deck);
        if (error != null) throw new IllegalArgumentException(error);
        return deck;
    }
}
