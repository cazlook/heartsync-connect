// BiometricDebugPanel.tsx - Complete debug system for biometric testing
import React, { useState, useEffect } from 'react';
import { useBiometric } from '../useBiometric';

interface DebugEvent {
  timestamp: number;
  event: string;
  bpm: number;
  baseline: number;
  z_score: number;
  duration?: number;
  confidence?: number;
}

interface BiometricDebugPanelProps {
  profileId: string;
}

export function BiometricDebugPanel({ profileId }: BiometricDebugPanelProps) {
  const { bpm, baselineMean, baselineStd, reaction, confidence } = useBiometric(profileId);
  const [debugMode, setDebugMode] = useState(false);
  const [fakeBPM, setFakeBPM] = useState(70);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationPattern, setSimulationPattern] = useState<string | null>(null);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [recentReactions, setRecentReactions] = useState<any[]>([]);

  // Calculate z-score
  const zScore = baselineStd > 0 ? (bpm - baselineMean) / baselineStd : 0;

  // Log events
  useEffect(() => {
    if (debugMode && reaction !== 'NONE') {
      const event: DebugEvent = {
        timestamp: Date.now(),
        event: 'reaction_detected',
        bpm,
        baseline: baselineMean,
        z_score: zScore,
        confidence,
      };
      setDebugEvents(prev => [event, ...prev].slice(0, 50));
      console.log('[BIOMETRIC DEBUG]', event);
    }
  }, [reaction, debugMode]);

  // BPM Simulator
  const setFakeBPMValue = (value: number) => {
    setFakeBPM(value);
    // TODO: Integrate with useBiometric to inject fake BPM
  };

  const startSimulation = (pattern: 'baseline' | 'medium' | 'high' | 'noise' | 'spike') => {
    setSimulationPattern(pattern);
    setSimulationActive(true);
  };

  const stopSimulation = () => {
    setSimulationActive(false);
    setSimulationPattern(null);
  };

  // Simulation engine
  useEffect(() => {
    if (!simulationActive || !simulationPattern) return;

    const interval = setInterval(() => {
      let newBPM = fakeBPM;
      
      switch (simulationPattern) {
        case 'baseline':
          newBPM = 70 + Math.random() * 2;
          break;
        case 'medium':
          newBPM = 82 + Math.random() * 3;
          break;
        case 'high':
          newBPM = 95 + Math.random() * 5;
          break;
        case 'noise':
          newBPM = 60 + Math.random() * 40;
          break;
        case 'spike':
          newBPM = Math.random() > 0.9 ? 100 : 70;
          break;
      }
      
      setFakeBPM(Math.round(newBPM));
    }, 1000);

    return () => clearInterval(interval);
  }, [simulationActive, simulationPattern]);

  if (!debugMode) {
    return (
      <button
        onClick={() => setDebugMode(true)}
        className="fixed bottom-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg"
      >
        🔬 Debug Mode
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 w-96 h-full bg-black/95 text-white p-4 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">🔬 Biometric Debug</h2>
        <button onClick={() => setDebugMode(false)} className="text-red-500">✕</button>
      </div>

      {/* Real-time Metrics */}
      <div className="bg-gray-900 p-4 rounded mb-4">
        <h3 className="font-bold mb-2">📊 Current Metrics</h3>
        <div className="space-y-1 text-sm">
          <div>BPM: <span className="text-green-400 font-mono">{bpm}</span></div>
          <div>Baseline: <span className="text-blue-400 font-mono">{baselineMean.toFixed(1)}</span></div>
          <div>Std Dev: <span className="text-blue-400 font-mono">{baselineStd.toFixed(1)}</span></div>
          <div>Z-Score: <span className="text-yellow-400 font-mono">{zScore.toFixed(2)}</span></div>
          <div>Reaction: <span className={`font-mono ${
            reaction === 'HIGH' ? 'text-red-400' :
            reaction === 'MEDIUM' ? 'text-orange-400' :
            reaction === 'LOW' ? 'text-yellow-400' : 'text-gray-400'
          }`}>{reaction}</span></div>
          <div>Confidence: <span className="text-purple-400 font-mono">{(confidence * 100).toFixed(0)}%</span></div>
        </div>
      </div>

      {/* BPM Simulator */}
      <div className="bg-gray-900 p-4 rounded mb-4">
        <h3 className="font-bold mb-2">🎛️ BPM Simulator</h3>
        <div className="space-y-2">
          <div>
            <input
              type="range"
              min="50"
              max="140"
              value={fakeBPM}
              onChange={(e) => setFakeBPMValue(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-lg font-mono">{fakeBPM} BPM</div>
          </div>
          
          <input
            type="number"
            value={fakeBPM}
            onChange={(e) => setFakeBPMValue(Number(e.target.value))}
            className="w-full bg-gray-800 px-2 py-1 rounded"
            min="50"
            max="140"
          />

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => startSimulation('baseline')} className="bg-blue-600 px-2 py-1 rounded text-xs">Baseline</button>
            <button onClick={() => startSimulation('medium')} className="bg-orange-600 px-2 py-1 rounded text-xs">Medium</button>
            <button onClick={() => startSimulation('high')} className="bg-red-600 px-2 py-1 rounded text-xs">High</button>
            <button onClick={() => startSimulation('noise')} className="bg-yellow-600 px-2 py-1 rounded text-xs">Noise</button>
            <button onClick={() => startSimulation('spike')} className="bg-purple-600 px-2 py-1 rounded text-xs">Spike</button>
            <button onClick={stopSimulation} className="bg-gray-600 px-2 py-1 rounded text-xs">Stop</button>
          </div>

          {simulationActive && (
            <div className="text-green-400 text-xs mt-2">▶ Simulation: {simulationPattern}</div>
          )}
        </div>
      </div>

      {/* Debug Events Log */}
      <div className="bg-gray-900 p-4 rounded mb-4">
        <h3 className="font-bold mb-2">📝 Event Log</h3>
        <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
          {debugEvents.length === 0 ? (
            <div className="text-gray-500">No events logged yet</div>
          ) : (
            debugEvents.map((evt, i) => (
              <div key={i} className="bg-gray-800 p-2 rounded">
                <div className="text-green-400">{evt.event}</div>
                <div>BPM: {evt.bpm} | Z: {evt.z_score.toFixed(2)} | Conf: {((evt.confidence || 0) * 100).toFixed(0)}%</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Reactions */}
      <div className="bg-gray-900 p-4 rounded">
        <h3 className="font-bold mb-2">💾 Recent Reactions</h3>
        <div className="text-xs text-gray-500">TODO: Fetch from storage</div>
      </div>
    </div>
  );
}
