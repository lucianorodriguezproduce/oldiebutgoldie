// @ts-ignore - Essentia.js might not have perfect TS definitions in some environments
import Essentia from 'essentia.js';
// @ts-ignore
import { EssentiaWASM } from 'essentia.js';

export interface AnalysisResult {
    bpm: number;
    key: string; // Clean format (e.g., "Am")
    camelot: string; // Camelot code (e.g., "8A")
}

class AudioAnalysisService {
    private essentia: any;
    private initialized: boolean = false;

    constructor() {
        // Essentia should be available as a global or imported from essentia.js
        // If it's the WASM version, we usually need to wait for the module to load
    }

    private async init() {
        if (this.initialized) return;

        console.log("[AudioAnalysis] Initializing Essentia.js...");
        try {
            let wasmModule;

            if (typeof EssentiaWASM !== 'undefined') {
                console.log("[AudioAnalysis] Using imported EssentiaWASM function.");
                wasmModule = await EssentiaWASM({ locateFile: (file: string) => `/${file}` });
            } else if (typeof (window as any).EssentiaWASM !== 'undefined') {
                console.log("[AudioAnalysis] Using window.EssentiaWASM function.");
                wasmModule = await (window as any).EssentiaWASM({ locateFile: (file: string) => `/${file}` });
            } else {
                console.error("[AudioAnalysis] EssentiaWASM is NOT defined. Check your imports and that essentia.js is correctly loaded.");
                throw new Error("EssentiaWASM is not defined");
            }

            if (!wasmModule) throw new Error("Could not load Essentia WASM module");

            this.essentia = new Essentia(wasmModule);
            this.initialized = true;
            console.log("[AudioAnalysis] Essentia.js Engine fully initialized.");
        } catch (error) {
            console.error("[AudioAnalysis-V18.7-CRITICAL] Global initialization failure:", error);
            throw error;
        }
    }

    private normalizeKey(key: string, scale: string): { simple: string, camelot: string } {
        const keyMap: Record<string, string> = {
            'C': 'C', 'C#': 'Db', 'D': 'D', 'D#': 'Eb', 'E': 'E', 'F': 'F',
            'F#': 'Gb', 'G': 'G', 'G#': 'Ab', 'A': 'A', 'A#': 'Bb', 'B': 'B'
        };

        const camelotMap: Record<string, { A: string, B: string }> = {
            'Ab': { A: '1A', B: '4B' },
            'Eb': { A: '2A', B: '5B' },
            'Bb': { A: '3A', B: '6B' },
            'F': { A: '4A', B: '7B' },
            'C': { A: '5A', B: '8B' },
            'G': { A: '6A', B: '9B' },
            'D': { A: '7A', B: '10B' },
            'A': { A: '8A', B: '11B' },
            'E': { A: '9A', B: '12B' },
            'B': { A: '10A', B: '1B' },
            'Gb': { A: '11A', B: '2B' },
            'Db': { A: '12A', B: '3B' }
        };

        const normalizedKey = keyMap[key] || key;
        const isMinor = scale.toLowerCase().includes('minor');
        const suffix = isMinor ? 'm' : '';
        const simple = `${normalizedKey}${suffix}`;

        const camelot = camelotMap[normalizedKey]?.[isMinor ? 'A' : 'B'] || "";

        return { simple, camelot };
    }

    async analyzeAudio(url: string): Promise<AnalysisResult> {
        try {
            await this.init();

            console.log(`[AudioAnalysis] Starting analysis for: ${url}`);

            // 1. Fetch the audio file using the Sovereign Proxy (Protocol V18.7)
            const proxyUrl = `/api/media?service=proxy&url=${encodeURIComponent(url)}`;
            console.log(`[AudioAnalysis] Fetching audio through proxy: ${proxyUrl}`);
            const response = await fetch(proxyUrl);

            if (!response.ok) {
                console.error(`[AudioAnalysis-V18.7-CRITICAL] Proxy failed to fetch audio. Status: ${response.status}`);
                throw new Error(`Audio fetch proxy failed with status ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            // 2. Decode audio data
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            // 3. Prepare data for Essentia (Mono, Float32Array)
            const channelData = audioBuffer.getChannelData(0);
            const vectorSignal = this.essentia.arrayToVector(channelData);

            // 4. Extract BPM
            // PercivalBPMEstimator is good for short snippets
            const bpmResult = this.essentia.PercivalBPMEstimator(vectorSignal);
            const bpm = Math.round(bpmResult.bpm);

            // 5. Extract Key
            const keyResult = this.essentia.KeyExtractor(vectorSignal);
            const { simple, camelot } = this.normalizeKey(keyResult.key, keyResult.scale);

            console.log(`[AudioAnalysis] Done: BPM ${bpm}, Key ${simple} (${camelot})`);

            return {
                bpm,
                key: simple,
                camelot
            };
        } catch (error) {
            console.error(`[AudioAnalysis-V18.7-CRITICAL] Analysis completely failed for ${url}. Raw error object:`, error);
            throw error;
        }
    }
}

export const audioAnalysisService = new AudioAnalysisService();
