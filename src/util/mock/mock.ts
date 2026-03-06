import {Page} from '@playwright/test';
import {Mockable} from "../../testcase";
import {Youtube} from "./youtube";

export class Mock implements Mockable{

  mock(page: Page): Promise<void> {
    const f = async(page: Page): Promise<void> => {
      const youtube = new Youtube();
      await youtube.mock(page);
    }
    return f(page);
  }
}