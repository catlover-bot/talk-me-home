export function AboutPanel() {
  return <details className="shell-panel about-panel"><summary>About & privacy</summary><div className="shell-panel-content">
    <h2>One human. One robot. A shared plan.</h2>
    <p>Talk Me Home is a voice co-op rescue game. You have the documents and remote controls; Pip has local eyes and hands.</p>
    <h3>Three ways to play</h3>
    <p>Practice uses deterministic text matching with no AI provider or microphone. Live Voice sends speech and typed messages to AssemblyAI. Live Text also uses AssemblyAI, with the microphone off. Live transcripts and replies come from that service.</p>
    <h3>Your session</h3>
    <p>Pause ends the call and preserves committed mission progress in this open page. Resume starts a new connection only when you choose it. Refreshing or closing the page, session expiry, or a server restart can lose the mission. There is no durable autosave.</p>
    <p>This app does not save audio recordings. It keeps bounded captions and mission records in server memory for this session. Private notes and map annotations are excluded from Pip’s recap; communicated messages and earlier robot reports may be included.</p>
    <p>Live data is processed by AssemblyAI under the host’s provider configuration. See <a href="https://www.assemblyai.com/legal/privacy-policy" target="_blank" rel="noreferrer">AssemblyAI’s privacy policy</a>.</p>
    <h3>Credits</h3>
    <p>Original UNIT 04 character, station illustrations, documents, and interface artwork were created for Talk Me Home. Voice integration builds on the AssemblyAI Voice Agent starter. React and Vite support the browser application.</p>
  </div></details>;
}
