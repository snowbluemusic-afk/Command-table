package forge.app;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import forge.StaticData;
import forge.commandtable.CommandTableForgeDecks;
import forge.commandtable.CommandTableForgeInput;
import forge.commandtable.CommandTableCardCatalog;
import forge.commandtable.CommandTableChoiceDispatcher;
import forge.commandtable.CommandTableGameProjection;
import forge.commandtable.CommandTableGuiProxy;
import forge.commandtable.CommandTableMatchLauncher;
import forge.deck.Deck;
import forge.game.GameView;
import forge.game.player.PlayerView;
import forge.gamemodes.match.HostedMatch;
import forge.gui.FThreads;
import forge.gui.GuiBase;
import forge.gui.interfaces.IGuiGame;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Command Table interface hosted INSIDE Forge's Android process. Never opens
 * a separate Forge APK; all game rules/AI are the upstream Java engine.
 *
 * Development integration: complex Forge choice UI still delegates to the
 * native MatchController. This is not ready to ship without full prompt UX.
 */
public final class CommandTableOverlay {
    private static final Handler UI = new Handler(Looper.getMainLooper());
    private static final ExecutorService REQUESTS = Executors.newSingleThreadExecutor();
    private static volatile CommandTableMain host;
    private static volatile WebView web;
    private static volatile HostedMatch match;
    private static volatile CommandTableForgeInput input;
    private static volatile CommandTableChoiceDispatcher choices;
    private static volatile String pendingStart;

    private CommandTableOverlay() {}

    public static void install(CommandTableMain activity) {
        UI.post(() -> {
            if (web != null && host != activity) {
                web.removeJavascriptInterface("CommandTableEngine");
                web.removeJavascriptInterface("AndroidBridge");
                web.destroy();
                web=null;
            }
            host = activity;
            if (web != null) {
                web.bringToFront();
                return;
            }
            WebView view = new WebView(activity);
            view.getSettings().setJavaScriptEnabled(true);
            view.getSettings().setDomStorageEnabled(true);
            view.getSettings().setAllowFileAccess(false);
            view.getSettings().setAllowContentAccess(false);
            view.setWebChromeClient(new WebChromeClient());
            view.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                    Uri u = req.getUrl();
                    if ("https".equals(u.getScheme())
                        && "appassets.androidplatform.net".equals(u.getHost())
                        && "/assets/index.html".equals(u.getPath())) return false;
                    if ("https".equals(u.getScheme()) || "http".equals(u.getScheme())) {
                        try { activity.startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                    }
                    return true;
                }
                @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                    Uri u = req.getUrl();
                    if ("https".equals(u.getScheme())
                            && "appassets.androidplatform.net".equals(u.getHost())
                            && "/assets/index.html".equals(u.getPath())) {
                        try {
                            InputStream html = activity.getAssets().open("command-table.html");
                            return new WebResourceResponse("text/html", "UTF-8", html);
                        } catch (Exception ignored) {}
                    }
                    return null;
                }
            });
            view.addJavascriptInterface(new Bridge(activity), "CommandTableEngine");
            view.addJavascriptInterface(new DeviceBridge(activity), "AndroidBridge");
            web = view;
            activity.addContentView(view, new FrameLayout.LayoutParams(-1, -1));
            view.loadUrl("https://appassets.androidplatform.net/assets/index.html");
        });
    }

    /** Detach the WebView when its Android activity is destroyed. */
    public static void release(CommandTableMain activity) {
        UI.post(() -> {
            if (host != activity) return;
            if (web != null) {
                web.removeJavascriptInterface("CommandTableEngine");
                web.removeJavascriptInterface("AndroidBridge");
                web.destroy();
                web=null;
            }
            host=null;
        });
    }

    /** System back returns from the native prompt fallback to Command Table. */
    public static boolean handleBack() {
        WebView view=web;
        if(view==null)return false;
        if(view.getVisibility()!=android.view.View.VISIBLE) {
            show();
            return true;
        }
        UI.post(() -> view.evaluateJavascript(
            "window.commandTableBack ? window.commandTableBack() : null",null));
        return true;
    }

    public static void hideForNativePrompt() {
        UI.post(() -> { if (web != null) web.setVisibility(android.view.View.GONE); });
    }
    public static void show() {
        UI.post(() -> { if (web != null) {web.setVisibility(android.view.View.VISIBLE);web.bringToFront();} });
    }

    private static boolean initialized() {
        try {
            return GuiBase.getInterface() != null && StaticData.instance() != null;
        } catch (Throwable err) { return false; }
    }

    private static void respond(String id, boolean ok, Object payload, String error) {
        JSONObject obj = new JSONObject();
        try {
            obj.put("v",1).put("id",id).put("ok",ok);
            if (payload != null) obj.put("payload",payload);
            if (!ok) obj.put("error",error == null ? "Forge command failed" : error);
            send(obj);
        } catch(Exception ignored) {}
    }

    private static void send(JSONObject value) {
        UI.post(() -> {
            if (web != null) web.evaluateJavascript(
                "window.CommandTableNativeReply("+JSONObject.quote(value.toString())+")", null);
        });
    }

    private static void publishSelection(Map<String, Object> selection) {
        try {
            send(new JSONObject().put("v",1).put("type","game.selection")
                .put("payload",new JSONObject(selection)));
        } catch (Exception error) {
            android.util.Log.e("CommandTable", "Could not display legal selections", error);
        }
    }

    private static void publishChoice(Map<String, Object> prompt) {
        try {
            send(new JSONObject().put("v", 1).put("type", "game.choice")
                .put("payload", new JSONObject(prompt)));
        } catch (Exception error) {
            android.util.Log.e("CommandTable", "Could not publish Forge player decision", error);
        }
    }

    private static void publishPrompt(Map<String, Object> prompt) {
        try {
            send(new JSONObject().put("v", 1).put("type", "game.prompt")
                .put("payload", new JSONObject(prompt)));
        } catch (Exception ignored) {}
    }

    private static void publish(GameView game) {
        if (game == null || game.getPlayers().isEmpty()) return;
        try {
            PlayerView human=game.getPlayers().get(0);
            Map<String,Object> snapshot = CommandTableGameProjection.snapshot(game,human);
            JSONObject gameJson=new JSONObject(snapshot);
            String id=pendingStart;
            if (id!=null) {
                pendingStart=null;
                JSONObject payload=new JSONObject().put("game",gameJson);
                respond(id,true,payload,null);
            } else {
                send(new JSONObject().put("v",1).put("type","game.state").put("payload",gameJson));
            }
        } catch(Exception ex) {
            String id=pendingStart;
            if(id!=null){pendingStart=null;respond(id,false,null,ex.getMessage());}
        }
    }

    private static Deck decodeDeck(JSONObject o) throws Exception {
        String name=o.optString("name","Untitled");
        String commander=o.optString("commander","");
        JSONArray cards=o.optJSONArray("main");
        if (cards==null) throw new IllegalArgumentException("Missing main deck");
        List<String> names=new ArrayList<>();
        for(int i=0;i<cards.length();i++) names.add(cards.getString(i));
        return CommandTableForgeDecks.validated(name,commander,names);
    }

    private static void validateCommanderDeck(String id, JSONObject deckJson) {
        if (!initialized()) {
            respond(id, false, null, "Forge is still loading its card database");
            return;
        }
        try {
            JSONArray cards = deckJson.getJSONArray("main");
            List<String> main = new ArrayList<>();
            for (int i=0; i<cards.length(); i++) main.add(cards.getString(i));
            Deck deck = CommandTableForgeDecks.fromImport(
                deckJson.optString("name", "Untitled"),
                deckJson.optString("commander", ""), main);
            String issue = CommandTableForgeDecks.validationError(deck);
            respond(id, true, new JSONObject()
                .put("valid", issue == null)
                .put("reason", issue == null ? "Legal Commander deck" : issue), null);
        } catch (Exception ex) {
            try {
                respond(id, true, new JSONObject().put("valid", false)
                    .put("reason", ex.getMessage()), null);
            } catch (Exception ignored) {}
        }
    }

    private static void begin(String id, JSONObject p) {
        if (!initialized()) {respond(id,false,null,"Forge card assets are still initializing");return;}
        try {
            JSONObject deckObject=p.getJSONObject("deck");
            final Deck own=decodeDeck(deckObject);
            int count=p.optInt("opponents",1);
            if(count<1 || count>3) throw new IllegalArgumentException("Choose 1, 2 or 3 AI opponents");
            List<Deck> enemies=new ArrayList<>();
            JSONArray saved=p.optJSONArray("decks");
            for(int i=0;i<count;i++) {
                Deck opponent=null;
                if(saved!=null) {
                    for(int j=0;j<saved.length();j++) {
                        try {
                            JSONObject item=saved.getJSONObject((i+j)%saved.length());
                            Deck candidate=decodeDeck(item);
                            if(!candidate.getName().equals(own.getName())) {opponent=candidate;break;}
                        } catch(Exception ignored) {}
                    }
                }
                enemies.add(opponent==null?new Deck(own):opponent);
            }
            FThreads.invokeInEdtNowOrLater(() -> {
                try {
                    IGuiGame base=GuiBase.getInterface().getNewGuiGame();
                    CommandTableChoiceDispatcher old=choices;
                    if (old != null) old.cancelAll();
                    choices = new CommandTableChoiceDispatcher(CommandTableOverlay::publishChoice);
                    IGuiGame proxy=CommandTableGuiProxy.wrap(base,
                        () -> match==null?null:match.getGameView(),
                        CommandTableOverlay::publish,
                        CommandTableOverlay::publishPrompt,
                        CommandTableOverlay::publishSelection,
                        choices,
                        CommandTableOverlay::hideForNativePrompt,
                        CommandTableOverlay::show);
                    pendingStart=id;
                    match=CommandTableMatchLauncher.start(own,enemies,proxy,m -> {
                        match=m;
                        input=new CommandTableForgeInput(m);
                    });
                    if(match.getGameView()!=null)publish(match.getGameView());
                } catch(Throwable err) {
                    pendingStart=null;
                    respond(id,false,null,"Forge match start failed: "+err.getMessage());
                }
            });
        } catch(Exception ex){respond(id,false,null,ex.getMessage());}
    }

    private static void command(String id, JSONObject p) {
        CommandTableForgeInput bridge=input;
        if(bridge==null){respond(id,false,null,"No active Forge match");return;}
        String action=p.optString("action","");
        Object value=p.opt("value");
        try {
            switch(action) {
                case "playInspected":case "castSelected":case "selectHand":
                    if (value == null || JSONObject.NULL.equals(value)) {
                        throw new IllegalArgumentException("Select a card to play");
                    }
                    int pos = Integer.parseInt(String.valueOf(value));
                    GameView view=match.getGameView();
                    if(view==null)throw new IllegalStateException("Game not started");
                    PlayerView human=view.getPlayers().get(0);
                    if(pos>=0 && pos<human.getHand().size()) {
                        bridge.selectCard(human.getHand().get(pos).getId());
                    } else if(pos==-1 && !human.getCommand().isEmpty()) {
                        bridge.selectCard(human.getCommand().get(0).getId());
                    } else {
                        throw new IllegalArgumentException("Card selection outside hand/command zone");
                    }
                    break;
                case "permanent":case "cardId":
                    bridge.selectCard(Integer.parseInt(String.valueOf(value)));break;
                case "selectPlayer":
                    bridge.selectPlayer(Integer.parseInt(String.valueOf(value)));break;
                case "selectStack":
                    bridge.selectStack(Integer.parseInt(String.valueOf(value)));break;
                case "chooseCastTarget":
                    String target=String.valueOf(value);
                    String[] parts=target.split(":");
                    if(parts.length<2)throw new IllegalArgumentException("Invalid target");
                    if("player".equals(parts[0]))bridge.selectPlayer(Integer.parseInt(parts[1]));
                    else if("perm".equals(parts[0]))bridge.selectCard(Integer.parseInt(parts[parts.length-1]));
                    else if("stack".equals(parts[0]))bridge.selectStack(Integer.parseInt(parts[1]));
                    else throw new IllegalArgumentException("Invalid target type");
                    break;
                case "resolve":case "toCombat":case "endTurn":case "confirmBlocks":
                case "attack":case "continueCpu":
                    bridge.confirm();break;
                case "targetPlayer":
                    bridge.selectPlayer(Integer.parseInt(String.valueOf(value)));break;
                case "chooseBlock": {
                    String[] blockParts=String.valueOf(value).split("\\|",-1);
                    if(blockParts.length!=2)throw new IllegalArgumentException("Expected attacker and blocker");
                    if(!blockParts[1].isEmpty()) bridge.selectCard(Integer.parseInt(blockParts[1]));
                    else bridge.confirm();
                    break;
                }
                case "autoBlocks":
                    throw new IllegalArgumentException(
                        "Choose blockers yourself with Forge's legal target buttons");
                case "cancelCastTarget": bridge.cancel();break;
                case "concede": case "quitGame": bridge.concede();break;
                default:throw new IllegalArgumentException("Native action not wired: "+action);
            }
            // The real Forge game thread broadcasts its next authoritative state.
            respond(id,true,new JSONObject(),null);
        } catch(Exception ex){respond(id,false,null,ex.getMessage());}
    }

    public static final class Bridge {
        private final Context context;
        Bridge(Context context){this.context=context;}
        @JavascriptInterface public void request(String json) {
            REQUESTS.execute(() -> {
                String id="";
                try {
                    JSONObject req=new JSONObject(json);
                    id=req.optString("id","");
                    if(req.optInt("v")!=1){respond(id,false,null,"Unsupported protocol version");return;}
                    String type=req.optString("type","");
                    JSONObject p=req.optJSONObject("payload");
                    if(p==null)p=new JSONObject();
                    switch(type) {
                        case "engine.status":
                            JSONObject status=new JSONObject().put("protocol",1).put("engine","forge")
                                .put("ready",initialized())
                                .put("provider","embedded-forge-android")
                                .put("matchActive",match!=null && match.getGameView()!=null);
                            respond(id,true,status,null);
                            CommandTableChoiceDispatcher activeChoice=choices;
                            if(activeChoice!=null && match!=null && match.getGameView()!=null)
                                activeChoice.replayPending();
                            break;
                        case "deck.validate":
                            validateCommanderDeck(id,p.getJSONObject("deck"));break;
                        case "card.search": {
                            if(!initialized()){respond(id,false,null,"Forge card catalog is still starting");break;}
                            List<Map<String,Object>> cards=CommandTableCardCatalog.search(
                                p.optString("query",""),p.optBoolean("commanderOnly",false),
                                p.optInt("limit",50));
                            respond(id,true,new JSONObject().put("cards",new JSONArray(cards)),null);
                            break;
                        }
                        case "cards.resolve": {
                            if(!initialized()){respond(id,false,null,"Forge card catalog is still starting");break;}
                            JSONArray incoming=p.optJSONArray("names");
                            List<String> names=new ArrayList<>();
                            if(incoming!=null)for(int i=0;i<incoming.length();i++)
                                names.add(incoming.getString(i));
                            List<Map<String,Object>> resolved=CommandTableCardCatalog.resolveNames(names);
                            respond(id,true,new JSONObject().put("cards",new JSONArray(resolved)),null);
                            break;
                        }
                        case "choice.answer": {
                            CommandTableChoiceDispatcher dispatcher=choices;
                            if (dispatcher==null) {respond(id,false,null,"No active human decision");break;}
                            JSONArray indices=p.optJSONArray("indices");
                            List<Integer> selected=new ArrayList<>();
                            if (indices!=null) for(int i=0;i<indices.length();i++)
                                selected.add(indices.getInt(i));
                            Map<Integer,Integer> allocation=new LinkedHashMap<>();
                            JSONObject amounts=p.optJSONObject("allocation");
                            if(amounts!=null) {
                                Iterator<String> keys=amounts.keys();
                                while(keys.hasNext()) {
                                    String key=keys.next();
                                    allocation.put(Integer.parseInt(key), amounts.getInt(key));
                                }
                            }
                            boolean accepted=dispatcher.answer(
                                p.optString("choiceId",""),selected,p.optString("text",""),
                                p.optBoolean("cancelled",false),p.optBoolean("remember",false),
                                allocation);
                            respond(id,true,new JSONObject().put("accepted",accepted),null);
                            break;
                        }
                        case "game.snapshot": {
                            HostedMatch current=match;
                            if(current==null || current.getGameView()==null)
                                respond(id,false,null,"No active Commander game");
                            else {
                                Map<String,Object> state=CommandTableGameProjection.snapshot(
                                    current.getGameView(),current.getGameView().getPlayers().get(0));
                                respond(id,true,new JSONObject().put("game",new JSONObject(state)),null);
                            }
                            break;
                        }
                        case "match.start": begin(id,p);break;
                        case "game.command":command(id,p);break;
                        default:respond(id,false,null,"Unknown native method: "+type);
                    }
                } catch(Exception ex){respond(id,false,null,ex.getMessage());}
            });
        }
    }

    public static final class DeviceBridge {
        private final Context context;
        DeviceBridge(Context context){this.context=context;}
        @JavascriptInterface public void copyText(String value) {
            UI.post(() -> {
                ClipboardManager c=(ClipboardManager)context.getSystemService(Context.CLIPBOARD_SERVICE);
                if(c!=null)c.setPrimaryClip(ClipData.newPlainText("Deck",value));
            });
        }
        @JavascriptInterface public void setOrientation(String mode) {
            // Forge's libGDX rendering thread owns orientation.
        }
        @JavascriptInterface public void showNativePrompts() {hideForNativePrompt();}
        @JavascriptInterface public void returnToCommandTable() {show();}
    }
}
