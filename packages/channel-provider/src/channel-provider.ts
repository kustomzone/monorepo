import EventEmitter from 'eventemitter3';
import {Guid} from 'guid-typescript';
import {MessagingService} from './messaging-service';
import {
  ChannelProviderInterface,
  isJsonRpcNotification,
  MethodRequestType,
  MethodResponseType,
  Method,
  Response
} from './types';
import {UIService} from './ui-service';

class ChannelProvider implements ChannelProviderInterface {
  protected readonly events: EventEmitter<Response>;
  protected readonly ui: UIService;
  protected readonly messaging: MessagingService;
  protected readonly subscriptions: {[key in Response]: string[]};
  protected url = '';

  constructor() {
    this.events = new EventEmitter<Response>();
    this.events.emit = (method: Response, params: Request) => this.events.emit(method, params); // annotate the input parameters
    // TODO use a conditional type, or otherwise couple method with params
    this.ui = new UIService();
    this.messaging = new MessagingService();
    this.subscriptions = {
      ChannelProposed: [],
      ChannelUpdated: [],
      ChannelClosed: [],
      BudgetUpdated: [],
      MessageQueued: []
    };
  }

  async enable(url?: string) {
    window.addEventListener('message', this.onMessage.bind(this));

    if (url) {
      this.url = url;
    }

    this.ui.setUrl(this.url);
    this.messaging.setUrl(this.url);

    await this.ui.mount();
  }

  async send(request: MethodRequestType): Promise<MethodResponseType[MethodRequestType['method']]> {
    const target = await this.ui.getTarget();
    const response = await this.messaging.request(target, {
      jsonrpc: '2.0',
      method: request.method,
      params: request.params
    });

    return response;
  }

  async subscribe(subscriptionType: Response): Promise<string> {
    const subscriptionId = Guid.create().toString();
    this.subscriptions[subscriptionType].push(subscriptionId);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    (Object.keys(this.subscriptions) as Response[]).map(e => {
      this.subscriptions[e] = this.subscriptions[e]
        ? this.subscriptions[e].filter(s => s !== subscriptionId)
        : [];
    });
    return true;
  }

  on(event: Response, callback: EventEmitter.ListenerFn<any>): void {
    this.events.on(event, callback);
  }

  off(event: Response, callback?: EventEmitter.ListenerFn<any> | undefined): void {
    this.events.off(event, callback);
  }

  protected async onMessage(event: MessageEvent) {
    const message = event.data;
    if (!message.jsonrpc) {
      return;
    }

    if (isJsonRpcNotification(message)) {
      const eventName = message.method as Response;
      if ((eventName as any) === 'UIUpdate') {
        this.ui.setVisibility(message.params.showWallet);
      }
      this.events.emit(eventName as Response, message);

      if (this.subscriptions[eventName]) {
        this.subscriptions[eventName].forEach(s => {
          this.events.emit(s as Response, message);
        });
      }
    }
  }
}
const channelProvider = new ChannelProvider();

export {channelProvider};
