import type { JourneyDefinition, JourneysConfig } from '../types/index.js';

export type JourneyStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface JourneyState {
  name: string;
  status: JourneyStatus;
  currentStep: number;
  totalSteps: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export class JourneyRunner {
  private states = new Map<string, JourneyState>();

  constructor(private journeys: JourneysConfig) {
    for (const [name, journey] of Object.entries(journeys)) {
      this.states.set(name, {
        name,
        status: 'pending',
        currentStep: 0,
        totalSteps: journey.steps.length,
      });
    }
  }

  listJourneys(): {
    name: string;
    description: string;
    mode: string;
    dependsOn?: string[];
    status: JourneyStatus;
    stepCount: number;
  }[] {
    return Object.entries(this.journeys).map(([name, journey]) => ({
      name,
      description: journey.description,
      mode: journey.mode,
      dependsOn: journey.dependsOn,
      status: this.states.get(name)?.status ?? 'pending',
      stepCount: journey.steps.length,
    }));
  }

  getJourney(name: string): JourneyDefinition | null {
    return this.journeys[name] ?? null;
  }

  getStatus(): JourneyState[] {
    return [...this.states.values()];
  }

  getState(name: string): JourneyState | null {
    return this.states.get(name) ?? null;
  }

  startJourney(name: string): void {
    const journey = this.journeys[name];
    if (!journey) throw new Error(`Journey "${name}" not found`);

    // Check dependencies
    if (journey.dependsOn) {
      for (const dep of journey.dependsOn) {
        const depState = this.states.get(dep);
        if (!depState || depState.status !== 'completed') {
          throw new Error(
            `Journey "${name}" depends on "${dep}" which is ${depState?.status ?? 'not found'}`,
          );
        }
      }
    }

    this.states.set(name, {
      name,
      status: 'in_progress',
      currentStep: 0,
      totalSteps: journey.steps.length,
      startedAt: Date.now(),
    });
  }

  advanceStep(name: string): void {
    const state = this.states.get(name);
    if (!state) throw new Error(`Journey "${name}" not found`);
    if (state.status !== 'in_progress') throw new Error(`Journey "${name}" is not in progress`);

    state.currentStep++;
    if (state.currentStep >= state.totalSteps) {
      state.status = 'completed';
      state.completedAt = Date.now();
    }
  }

  completeJourney(name: string): void {
    const state = this.states.get(name);
    if (!state) throw new Error(`Journey "${name}" not found`);
    state.status = 'completed';
    state.completedAt = Date.now();
  }

  failJourney(name: string, error: string): void {
    const state = this.states.get(name);
    if (!state) throw new Error(`Journey "${name}" not found`);
    state.status = 'failed';
    state.error = error;
    state.completedAt = Date.now();
  }

  getExecutionOrder(): string[] {
    const resolved: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) throw new Error(`Circular dependency detected involving "${name}"`);

      visiting.add(name);
      const journey = this.journeys[name];
      if (journey?.dependsOn) {
        for (const dep of journey.dependsOn) {
          if (!this.journeys[dep]) throw new Error(`Dependency "${dep}" not found for "${name}"`);
          visit(dep);
        }
      }
      visiting.delete(name);
      visited.add(name);
      resolved.push(name);
    };

    for (const name of Object.keys(this.journeys)) {
      visit(name);
    }

    return resolved;
  }
}
