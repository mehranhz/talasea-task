export type Constructor<T> = abstract new (...args: never[]) => T;

export class InfraToken<T> {
  declare readonly __type: T;
  /** Names a value that is not a class, so config, the logger, and Redis can be registered like other providers. */
  constructor(readonly name: string) {}
}

export type Token<T> = Constructor<T> | InfraToken<T>;

export class Container {
  private readonly factories = new Map<Token<unknown>, (c: Container) => unknown>();
  private readonly instances = new Map<Token<unknown>, unknown>();

  /** Stores a factory without calling it, so a provider can be registered before the dependencies it needs exist. */
  register<T>(token: Token<T>, factory: (c: Container) => T): void {
    this.factories.set(token as Token<unknown>, factory);
  }

  /** Builds the instance on first use and reuses it, so config, the logger, and Redis stay process-wide singletons. */
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
