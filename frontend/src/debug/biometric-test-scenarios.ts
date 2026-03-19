// biometric-test-scenarios.ts - Test scenarios for biometric algorithm validation

export interface TestScenario {
  name: string;
  description: string;
  bpm?: number; // Static BPM value
  bpmSequence?: number[]; // For dynamic patterns like NOISE
  duration: number; // milliseconds
  expectedReaction: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'NO_REACTION',
    description: 'BPM stays at baseline (~72), no reaction should be detected',
    bpm: 72,
    duration: 5000,
    expectedReaction: 'NONE',
  },
  {
    name: 'MEDIUM_REACTION',
    description: 'BPM moderately elevated (83), should trigger MEDIUM reaction',
    bpm: 83,
    duration: 5000,
    expectedReaction: 'MEDIUM',
  },
  {
    name: 'HIGH_REACTION',
    description: 'BPM significantly elevated (97), should trigger HIGH reaction',
    bpm: 97,
    duration: 5000,
    expectedReaction: 'HIGH',
  },
  {
    name: 'NOISE',
    description: 'Erratic BPM changes, should be filtered out by instability check',
    bpmSequence: [60, 100, 65, 98, 62],
    duration: 5000,
    expectedReaction: 'NONE',
  },
  {
    name: 'SINGLE_SPIKE',
    description: 'Brief spike <1s, should be ignored due to duration requirement (>= 2s)',
    bpm: 110,
    duration: 800,
    expectedReaction: 'NONE',
  },
  {
    name: 'EXERCISE_BPM',
    description: 'Very high BPM (>120), should be filtered by context filter',
    bpm: 130,
    duration: 5000,
    expectedReaction: 'NONE',
  },
];

/**
 * Get a test scenario by name
 */
export function getScenario(name: string): TestScenario | undefined {
  return TEST_SCENARIOS.find((s) => s.name === name);
}

/**
 * Get all scenario names
 */
export function getScenarioNames(): string[] {
  return TEST_SCENARIOS.map((s) => s.name);
}
