package forge.commandtable;

import forge.deck.Deck;
import forge.game.GameRules;
import forge.game.GameType;
import forge.game.player.RegisteredPlayer;
import forge.gamemodes.match.HostedMatch;
import forge.gui.interfaces.IGuiGame;
import forge.player.GamePlayerUtil;
import forge.player.LobbyPlayerHuman;
import forge.model.FModel;
import forge.localinstance.properties.ForgePreferences.FPref;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/**
 * Authoritative match entry point. Does not simulate or calculate spells in the UI.
 * The IGuiGame adapter MUST handle all priority, targeting, combat and choice callbacks.
 */
public final class CommandTableMatchLauncher {
    private CommandTableMatchLauncher() {}

    public static HostedMatch start(Deck humanDeck, List<Deck> aiDecks, IGuiGame ui) {
        return start(humanDeck, aiDecks, ui, match -> { });
    }

    public static HostedMatch start(Deck humanDeck, List<Deck> aiDecks, IGuiGame ui,
                                    Consumer<HostedMatch> onCreated) {
        if (humanDeck == null || ui == null || aiDecks == null) {
            throw new IllegalArgumentException("Human deck, AI decks and UI are required");
        }
        if (aiDecks.size() < 1 || aiDecks.size() > 3) {
            throw new IllegalArgumentException("Commander supports one to three AI opponents");
        }
        checkDeck(humanDeck, "Your deck");
        for (int i = 0; i < aiDecks.size(); i++) checkDeck(aiDecks.get(i), "AI " + (i + 1));

        List<RegisteredPlayer> players = new ArrayList<>();
        RegisteredPlayer human = RegisteredPlayer.forCommander(humanDeck)
            .setPlayer(new LobbyPlayerHuman("You"));
        players.add(human);
        for (int i = 0; i < aiDecks.size(); i++) {
            RegisteredPlayer ai = RegisteredPlayer.forCommander(aiDecks.get(i))
                .setPlayer(GamePlayerUtil.createAiPlayer("AI " + (i + 1)));
            players.add(ai);
        }
        HostedMatch match = new HostedMatch();
        onCreated.accept(match);
        // The upstream AI-compatibility list is advisory (not a deck error).
        // On Android it opens an interrupting full-screen reveal dialog before
        // Command Table receives its first GameView, leaving the WebView on
        // its launch page. Keep real Commander rules and AI intact.
        GameRules rules = new GameRules(GameType.Commander);
        rules.setWarnAboutAICards(false);
        // Forge's InputPassPriority.getActionable() returns NO highlights
        // unless this preference is enabled. We run a custom UI and need
        // its authoritative playable-card IDs at every priority window.
        // Set before launching the match, not after the first prompt.
        FModel.getPreferences().setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS, true);
        match.startMatch(rules, Collections.emptySet(), players, human, ui);
        return match;
    }

    private static void checkDeck(Deck deck, String label) {
        String problem = CommandTableForgeDecks.validationError(deck);
        if (problem != null) throw new IllegalArgumentException(label + ": " + problem);
    }
}
