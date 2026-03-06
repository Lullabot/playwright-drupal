import { Page } from '@playwright/test';
import { Mockable } from "../../testcase";
export declare class Mock implements Mockable {
    mock(page: Page): Promise<void>;
}
