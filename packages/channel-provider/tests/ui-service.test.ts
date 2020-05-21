import {cssStyles, UIElementNames, UIService} from '../src/ui-service';

describe('UIService', () => {
  let uiService: UIService;

  beforeEach(async () => {
    uiService = new UIService();
    await uiService.mount();
  });

  it('should reference the correct UI elements in the style definition', () => {
    expect(cssStyles).toMatch(`iframe#${UIElementNames.IFrame}`);
    expect(cssStyles).toMatch(`div#${UIElementNames.Container}`);
  });

  it('should mount the UI', async () => {
    expect(document.querySelector(`#${UIElementNames.Styles}`)).toBeInstanceOf(HTMLStyleElement);
    expect(document.querySelector(`#${UIElementNames.Container}`)).toBeInstanceOf(HTMLDivElement);
    expect(document.querySelector(`#${UIElementNames.IFrame}`)).toBeInstanceOf(HTMLIFrameElement);
  });

  it('should unmount the UI', () => {
    uiService.unmount();

    expect(document.querySelector(`#${UIElementNames.Styles}`)).toBeNull();
    expect(document.querySelector(`#${UIElementNames.Container}`)).toBeNull();
    expect(document.querySelector(`#${UIElementNames.IFrame}`)).toBeNull();
  });

  // todo: this started failing with upgrading jest to 26.0.1 and ts-jest to 26.0.0
  //  Expected: [Function Window]
  //  Received: serializes to the same string
  // eslint-disable-next-line jest/no-commented-out-tests
  // it("should return a reference to the iframe's content window", async () => {
  //   const target = await uiService.getTarget();
  //   expect(target.constructor).toEqual(Window);
  // });
});
