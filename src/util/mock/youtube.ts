import {Page} from '@playwright/test';
import {Mockable} from "../../testcase";

export class Youtube implements Mockable{

  public async mock(page: Page): Promise<void> {
    const ytEmbedUrl = new RegExp('www\.youtube\.com', 'i');
    await page.route(ytEmbedUrl, async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: `
<html>
<head>
    <title>Youtube Video Mock</title>
    <style>
        body {
          color: white;
          background-color: darkred;
        }
        div {
          position: absolute;
          top: 50%;
          left: 50%;
          margin: 0;
          transform: translate(-50%, -50%);
          font-size: xxx-large;
          text-align: center;
        }
    </style>
</head>
<body>
    <div>Youtube Video Mock</div>
</body>
</html>
`,
      });
    });
  }

}
