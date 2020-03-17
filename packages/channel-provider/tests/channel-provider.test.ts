import {channelProvider} from '../src/channel-provider';

describe('ChannelProvider', () => {
  it('can be enabled', () => {
    const onMessageSpy = jest.spyOn(window, 'addEventListener');

    return new Promise(done => {
      channelProvider.on('Connect' as any, () => {
        expect(onMessageSpy).toHaveBeenCalled();
        done();
      });

      channelProvider.enable();
    });
  });
});
