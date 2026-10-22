// AudioWorkletGlobalScope, which TypeScript's DOM lib doesn't describe.

declare const sampleRate: number;
declare const currentFrame: number;
declare const currentTime: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
}

declare function registerProcessor(
  name: string,
  ctor: new (options: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;
