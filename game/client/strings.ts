export const copy = {
  title: "Talk Me Home",
  premise: "You have the map. Your partner has eyes and hands.",
  mission:
    "Guide a stranded robot through the cargo bay. Read your documents, share what you know, and work together.",
  greeting: "Mission Control, can you hear me? I need your help getting out.",
  mockNotice:
    "Simulation uses simple text matching and validated game actions. No AI, microphone, or paid connection.",
  liveNotice:
    "Live uses AssemblyAI. Voice and text both open a provider session, limited to 10 minutes.",
  idleCaption: "Your partner is waiting for a connection.",
  initialInstructions:
    "Start your mission, then talk with your robot. Your map shows the route; your partner can report local conditions.",
  stopped:
    "Mission stopped. The call is closed. Reconnect when you are ready; completed actions are preserved.",
  complete: "Arrival confirmed",
  completeDetail:
    "Your robot reached the far side. You made it through together.",
  resetTitle: "Restart this mission?",
  resetBody:
    "This ends the call, clears the conversation, and starts a fresh round. Your current progress will be lost.",
} as const;
