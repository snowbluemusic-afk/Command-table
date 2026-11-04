'use strict';
// Regression for the Forge Mobile WaitRunnable lost-notification race.
// Compile the ACTUAL UI dispatch method from CommandTableForgeInput with a
// deterministic fake GL scheduler, then exercise fast/late/failing actions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const src=fs.readFileSync('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java','utf8');
const overlay=fs.readFileSync('forge-integration/src/main/java/forge/app/CommandTableOverlay.java','utf8');
const planner=fs.readFileSync('forge-integration/web/sol-pod-combat-planner-v051.js','utf8');
assert(!src.includes('FThreads.invokeInEdtAndWait('),'No Forge input may use the racy WaitRunnable bridge');
assert(src.includes('requirePhase("COMBAT_DECLARE_BLOCKERS")')&&
       src.includes('instanceof InputBlock')&&
       overlay.includes('bridge.confirmBlocks();'),
       'Block confirmation must still verify the active Forge input and combat phase');
assert(planner.includes("action:'confirmBlocks'")&&
       planner.includes("'Skip blocking'")&&
       planner.includes('uncertain=true'),
       'Zero blockers must be confirmable exactly once, without blind retries');
const start=src.indexOf('    private static void runOnForgeUi(Runnable operation) {');
const stop=src.indexOf('    public void confirm() {',start);
assert(start>=0&&stop>start,'Native dispatch helper was not found');
const realMethod=src.slice(start,stop).replace('completed.await(8, TimeUnit.SECONDS)',
 'completed.await(750, TimeUnit.MILLISECONDS)');
assert(realMethod.includes('CountDownLatch')&&realMethod.includes('compareAndSet(0, 2)'),
 'Native timeout must atomically drop queued stale inputs');
const prefix=[
'import java.util.concurrent.*;',
'import java.util.concurrent.atomic.*;',
'public final class VerifySolPodLatch {',
'  static class FThreads {',
'    static volatile Thread gui;',
'    static final ExecutorService queue=Executors.newSingleThreadExecutor(r->{',
'      Thread t=new Thread(r,"test-gl");t.setDaemon(true);return t;});',
'    static boolean isGuiThread(){return Thread.currentThread()==gui;}',
'    static void invokeInEdtLater(Runnable r){queue.execute(()->{',
'      gui=Thread.currentThread();r.run();});}',
'  }'
].join('\n');
const suffix=[
'  public static void main(String[] args) throws Exception {',
'    AtomicInteger applied=new AtomicInteger();',
'    // A fast GL callback must never lose a notification and strand the worker.',
'    for(int i=0;i<400;i++)runOnForgeUi(applied::incrementAndGet);',
'    if(applied.get()!=400)throw new AssertionError("Fast acknowledgments lost");',
'    // Errors thrown on GL must return to the requesting thread.',
'    try {runOnForgeUi(()->{throw new IllegalArgumentException("rejected");});',
'      throw new AssertionError("Expected input rejection");',
'    } catch(IllegalArgumentException good){}',
'    // When GL is busy past the deadline, a queued skip must NOT be applied later.',
'    CountDownLatch gate=new CountDownLatch(1);',
'    FThreads.invokeInEdtLater(()->{try{gate.await();}',
'      catch(InterruptedException e){Thread.currentThread().interrupt();}});',
'    try{runOnForgeUi(applied::incrementAndGet);',
'      throw new AssertionError("Expected bounded timeout");',
'    }catch(IllegalStateException expected){',
'      if(!expected.getMessage().contains("cancelled"))throw expected;}',
'    gate.countDown();',
'    CountDownLatch flushed=new CountDownLatch(1);',
'    FThreads.invokeInEdtLater(flushed::countDown);',
'    if(!flushed.await(3,TimeUnit.SECONDS))throw new AssertionError("GL did not flush");',
'    if(applied.get()!=400)throw new AssertionError("A stale input was executed after timeout");',
'    // A direct UI-thread request executes synchronously, without enqueuing itself.',
'    CountDownLatch direct=new CountDownLatch(1);',
'    FThreads.invokeInEdtLater(()->{runOnForgeUi(applied::incrementAndGet);direct.countDown();});',
'    if(!direct.await(3,TimeUnit.SECONDS)||applied.get()!=401)',
'      throw new AssertionError("Direct UI input failed");',
'    FThreads.queue.shutdownNow();',
'    System.out.println("PASS Sol Pod v0.54 native latch: 400 fast commands, exception, timeout cancellation and direct UI");',
'  }',
'}'
].join('\n');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sol-pod-latch-'));
try{
 fs.writeFileSync(path.join(dir,'VerifySolPodLatch.java'),prefix+'\n'+realMethod+'\n'+suffix);
 cp.execFileSync('javac',['VerifySolPodLatch.java'],{cwd:dir,stdio:'inherit'});
 cp.execFileSync('java',['-cp',dir,'VerifySolPodLatch'],{cwd:dir,stdio:'inherit'});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
if(process.argv[2]){
 const html=fs.readFileSync(process.argv[2],'utf8');
 assert(html.includes("action:'confirmBlocks'")&&html.includes('Skip blocking'),
 'Embedded UI must still send one Forge-authoritative skip blocks command');
}
console.log('PASS Sol Pod v0.54 blocker UI/native regression');
