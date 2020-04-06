import {createMachine, StateMachine, AnyEventObject, Typestate} from 'xstate';

type TTypestate =
  | {value: 'a'; context: {aProp: string}}
  | {value: {b: 'b1'}; context: {b1Prop: string; aProp: string}}
  | {value: {b: 'b2'}; context: {b2Prop: string; aProp: string}};

type Context = TTypestate['context'];
type Event = {type: 'SOME_EVENT'};

type SubTypestate =
  | {value: 'b1'; context: {b1Prop: string}}
  | {value: 'b2'; context: {b2Prop: string}};

type SubContext = SubTypestate['context'];

type AddToContext<TTypestate, Y> = TTypestate extends {value: any; context: any}
  ? {value: TTypestate['value']; context: TTypestate['context'] & Y}
  : never;

const x = <Y>() =>
  createMachine<SubContext & Y, Event, AddToContext<SubTypestate, Y>>({
    states: {
      b1: {
        on: {
          SOME_EVENT: 'b2'
        }
      },
      b2: {
        on: {
          SOME_EVENT: 'b1'
        }
      }
    }
  });

export default createMachine<Context, Event, TTypestate>({
  states: {
    a: {
      on: {
        SOME_EVENT: 'b.b1'
      }
    },
    b: x<{aProp: string}>().config
  }
});
