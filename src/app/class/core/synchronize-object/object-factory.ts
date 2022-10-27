import { GameObject } from './game-object';

export declare var Type: FunctionConstructor;
export interface Type<T> extends Function {
  new(...args: any[]): T;
}

export class ObjectFactory {
  private static _instance: ObjectFactory
  static get instance(): ObjectFactory {
    if (!ObjectFactory._instance) ObjectFactory._instance = new ObjectFactory();
    return ObjectFactory._instance;
  }

  private constructorMap: Map<string, Type<GameObject>> = new Map();
  private aliasMap: Map<Type<GameObject>, string> = new Map();

  private constructor() { console.log('ObjectFactory ready...'); };

  register<T extends GameObject>(constructor: Type<T>, alias?: string) {
    if (!alias) alias = constructor.name ?? (constructor.toString().match(/function\s*([^(]*)\(/)?.[1] ?? '');
    if (this.constructorMap.has(alias)) {
      console.error('그 alias<' + alias + '> 는 이미 할당 끝났지 않아？');
      return;
    }
    if (this.aliasMap.has(constructor)) {
      console.error('그 constructor 는 이미 등록되어 있지 않아？', constructor);
      return;
    }
    console.log('addGameObjectFactory -> ' + alias);
    this.constructorMap.set(alias, constructor);
    this.aliasMap.set(constructor, alias);
  }

  create<T extends GameObject>(alias: string, identifer?: string): T | null {
    let classConstructor = this.constructorMap.get(alias);
    if (!classConstructor) {
      console.error(alias + '라는 이름의 GameObject클래스는 정의되어 있지 않습니다.');
      return null;
    }
    let gameObject: GameObject = new classConstructor(identifer);
    return <T>gameObject;
  }

  getAlias<T extends GameObject>(constructor: Type<T>): string {
    return this.aliasMap.get(constructor) ?? '';
  }
}
