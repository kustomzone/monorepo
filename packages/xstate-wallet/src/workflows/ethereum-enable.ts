// A workflow to guide the user through enabling window.ethereum

import {
  StateSchema,
  State,
  Action,
  MachineConfig,
  Machine,
  StateMachine,
  ServiceConfig,
  assign
} from 'xstate';
import {MessagingServiceInterface} from '../messaging';
import {Store} from '../store';
import {VERSION} from '../config';

interface UserApproves {
  type: 'USER_APPROVES_ENABLE';
}
interface UserRejects {
  type: 'USER_REJECTS_ENABLE';
}
export type WorkflowEvent = UserApproves | UserRejects;

export interface WorkflowContext {
  requestId: number;
  enabledAddress?: string;
}

export interface WorkflowServices extends Record<string, ServiceConfig<WorkflowContext>> {
  enableEthereum: () => Promise<string>;
}
export interface WorkflowStateSchema extends StateSchema<WorkflowContext> {
  states: {
    explainToUser: {};
    enabling: {};
    done: {};
    failure: {};
    retry: {};
  };
}
export type WorkflowState = State<WorkflowContext, WorkflowEvent, WorkflowStateSchema, any>;

export interface WorkflowActions {
  hideUi: Action<WorkflowContext, any>;
  displayUi: Action<WorkflowContext, any>;
  sendResponse: Action<WorkflowContext, any>;
  sendErrorResponse: Action<WorkflowContext, any>;
}
export type StateValue = keyof WorkflowStateSchema['states'];

const generateConfig = (
  actions: WorkflowActions
): MachineConfig<WorkflowContext, WorkflowStateSchema, WorkflowEvent> => ({
  id: 'enable-ethereum',
  initial: 'explainToUser',
  states: {
    explainToUser: {
      entry: [actions.displayUi],
      on: {
        USER_APPROVES_ENABLE: {target: 'enabling'},
        USER_REJECTS_ENABLE: {target: 'failure'}
      }
    },
    enabling: {
      invoke: {
        src: 'enableEthereum',
        onDone: {target: 'done', actions: assign({enabledAddress: (context, event) => event.data})},
        onError: 'failure'
      }
    }, // invoke ethereum enable
    retry: {
      on: {
        USER_APPROVES_ENABLE: {target: 'enabling'},
        USER_REJECTS_ENABLE: {target: 'failure'}
      }
    },
    done: {type: 'final', entry: [actions.hideUi, actions.sendResponse]},
    failure: {type: 'final', entry: [actions.hideUi, actions.sendErrorResponse]}
  }
});

export type WorkflowMachine = StateMachine<WorkflowContext, StateSchema, WorkflowEvent, any>;

export const ethereumEnableWorkflow = (
  store: Store,
  messagingService: MessagingServiceInterface,
  context: WorkflowContext
): WorkflowMachine => {
  const services: WorkflowServices = {
    enableEthereum: () => store.chain.ethereumEnable()
  };
  const actions = {
    displayUi: () => {
      messagingService.sendDisplayMessage('Show');
    },
    hideUi: () => {
      messagingService.sendDisplayMessage('Hide');
    },
    sendResponse: async (context: WorkflowContext) => {
      messagingService.sendResponse(context.requestId, {
        signingAddress: await store.getAddress(),
        walletVersion: VERSION,
        selectedAddress: context.enabledAddress as string
      });
    },
    sendErrorResponse: (context: WorkflowContext) => {
      messagingService.sendError(context.requestId, {code: 100, message: 'Ethereum Not Enabled'});
    }
  };
  const config = generateConfig(actions);
  return Machine(config).withConfig({services}, context) as WorkflowMachine;
};

// Mock values for diagram generation
// ==================================

const mockActions: WorkflowActions = {
  hideUi: 'hideUi',
  displayUi: 'displayUi',
  sendResponse: 'sendResponse',
  sendErrorResponse: 'sendErrorResponse'
};

export const mockServices: WorkflowServices = {
  enableEthereum: () =>
    new Promise(() => {
      /* Mock call */
    }) as any
};
export const mockOptions = {services: mockServices, actions: mockActions};
export const config = generateConfig(mockActions);
