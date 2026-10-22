export type Constructor<T> = abstract new (...args: never[]) => T;

export class InfraToken<T> {
  declare readonly __type: T;
  constructor(readonly name: string) {}
}

export type Token<T> = Constructor<T> | InfraToken<T>;

export class Container {
  private readonly factories = new Map<Token<unknown>, (c: Container) => unknown>();
  private readonly instances = new Map<Token<unknown>, unknown>();

  register<T>(token: Token<T>, factory: (c: Container) => T): void {
    this.factories.set(token as Token<unknown>, factory);
  }

  resolve<T>(token: Token<T>): T {
    const key = token as Token<unknown>;
    if (!this.instances.has(key)) {
      const factory = this.factories.get(key);
      if (!factory) {
        throw new Error(`Provider not found: ${(token as { name: string }).name}`);
      }
      this.instances.set(key, factory(this));
    }
    return this.instances.get(key) as T;
  }
}
