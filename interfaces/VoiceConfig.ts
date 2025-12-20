export interface VoiceSettings {
  voices: {
    text?: string | null;
    quote?: string | null;
    bold?: string | null;
    emphasis?: string | null;
    code?: string | null;
    tool_call?: string | null;
    tool_result?: string | null;
    reasoning?: string | null;
  };
  generation: {
    temperature?: number;
    exaggeration?: number;
    cfg_weight?: number;
    speed_factor?: number;
  };
}