# Changelog

## [1.7.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.6.0...playwright-drupal-1.7.0) (2026-04-21)


### Features

* **login:** accept numeric user ID ([#151](https://github.com/Lullabot/playwright-drupal/issues/151)) ([0a86f89](https://github.com/Lullabot/playwright-drupal/commit/0a86f89f3d0647bd45433a38bb864d38cea0af06))

## [1.6.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.5.1...playwright-drupal-1.6.0) (2026-04-21)


### Features

* **a11y:** default new tests to baseline mode, preserve snapshot mode for existing ([#120](https://github.com/Lullabot/playwright-drupal/issues/120)) ([eda6d43](https://github.com/Lullabot/playwright-drupal/commit/eda6d430d8d9e1f782d4e5784bd03825a0f2df23))
* add baseline allowlist and a11y fixture helper ([#105](https://github.com/Lullabot/playwright-drupal/issues/105)) ([37cd52e](https://github.com/Lullabot/playwright-drupal/commit/37cd52e397ae69ed2d41148857c423c739f78faa))
* add GitHub a11y annotations action and CLI ([4c90232](https://github.com/Lullabot/playwright-drupal/commit/4c902320b30ac6899a3eba86c260554d453328ad))
* add MkDocs documentation site with versioned GitHub Pages deployment ([#113](https://github.com/Lullabot/playwright-drupal/issues/113)) ([fd70861](https://github.com/Lullabot/playwright-drupal/commit/fd708614bbfad71fb85847371f18a5e894e3483e))
* add screenshotViolations option to highlight a11y errors ([e9e83cf](https://github.com/Lullabot/playwright-drupal/commit/e9e83cf5451bd3db559ad7f350bd88d23fdc023a))
* crop a11y screenshots to violation area and optimize with ImageMagick ([#112](https://github.com/Lullabot/playwright-drupal/issues/112)) ([fe0b2b5](https://github.com/Lullabot/playwright-drupal/commit/fe0b2b51b0060382bed2a13bf3b135b79098269f))
* extract checkAccessibility() with configurable options ([#104](https://github.com/Lullabot/playwright-drupal/issues/104)) ([03e4009](https://github.com/Lullabot/playwright-drupal/commit/03e4009de979a626c87bd96fc618a32f7b182a4e))
* **util:** add autosaveForm utilities ([#135](https://github.com/Lullabot/playwright-drupal/issues/135)) ([7cdd77c](https://github.com/Lullabot/playwright-drupal/commit/7cdd77cda47adb2e4c073dc96792258e1662e255))
* **util:** add Ckeditor5 class ([#128](https://github.com/Lullabot/playwright-drupal/issues/128)) ([0f0d939](https://github.com/Lullabot/playwright-drupal/commit/0f0d939186e2853d4f0f374e57fdda9626f084af))
* **util:** add dblog utilities ([#130](https://github.com/Lullabot/playwright-drupal/issues/130)) ([8276bea](https://github.com/Lullabot/playwright-drupal/commit/8276beacf9b3ae815a7a79b7eb7e841fb6635132))
* **util:** add entities.extractEntityIdFromPage ([#127](https://github.com/Lullabot/playwright-drupal/issues/127)) ([f278c93](https://github.com/Lullabot/playwright-drupal/commit/f278c938c4aee4fd298517aec4dd437c0c4776d7))
* **util:** add forms module for Drupal AJAX, gin, and submit plumbing ([#126](https://github.com/Lullabot/playwright-drupal/issues/126)) ([fdfcdb0](https://github.com/Lullabot/playwright-drupal/commit/fdfcdb00a4379337ccea2d6efb397017435c7174))
* **util:** add managedFile.uploadManagedFile ([#134](https://github.com/Lullabot/playwright-drupal/issues/134)) ([5a46ea0](https://github.com/Lullabot/playwright-drupal/commit/5a46ea0d9e38904f5f3b49e143620c32459c4729))
* **util:** add mediaLibrary.selectFirstMediaFromLibrary ([#133](https://github.com/Lullabot/playwright-drupal/issues/133)) ([ba81241](https://github.com/Lullabot/playwright-drupal/commit/ba812414487bb7d66a1bab3543c8c52f695285a0))
* **util:** add modules probe utilities ([#129](https://github.com/Lullabot/playwright-drupal/issues/129)) ([581940c](https://github.com/Lullabot/playwright-drupal/commit/581940c83ea301fa090898549b6920200c35ac9b))
* **util:** add oembed.fillOembedUrl ([#132](https://github.com/Lullabot/playwright-drupal/issues/132)) ([4d83fb8](https://github.com/Lullabot/playwright-drupal/commit/4d83fb82687074ae807dccc6e468b040f5bf8842))
* **util:** add statusReport parser ([#131](https://github.com/Lullabot/playwright-drupal/issues/131)) ([3df29a7](https://github.com/Lullabot/playwright-drupal/commit/3df29a73bf46d657773c9275b40b48c3f8a4c72c))


### Bug Fixes

* **a11y-annotations:** pipe summary stdout to $GITHUB_STEP_SUMMARY ([055acd5](https://github.com/Lullabot/playwright-drupal/commit/055acd5184c19bb9f78eb5e9a516843bf662e5b7))
* **a11y-annotations:** run npx inside the playwright install dir ([8976f99](https://github.com/Lullabot/playwright-drupal/commit/8976f99df9547755c2061250e5c5ac41a17faeab))
* **a11y:** treat 'missing' as baseline mode, not snapshot mode ([#124](https://github.com/Lullabot/playwright-drupal/issues/124)) ([41467c1](https://github.com/Lullabot/playwright-drupal/commit/41467c146b1e2a9b663910e9983a5037bcd1612f))

## [1.5.1](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.5.0...playwright-drupal-1.5.1) (2026-04-02)


### Bug Fixes

* remove docroot prefix from DRUPAL_DEV_SITE_PATH ([#101](https://github.com/Lullabot/playwright-drupal/issues/101)) ([ee29770](https://github.com/Lullabot/playwright-drupal/commit/ee29770e6b3888899cb0662f8d1f18991e672844))

## [1.5.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.4.1...playwright-drupal-1.5.0) (2026-04-02)


### Features

* capture CLI output as test attachments ([#97](https://github.com/Lullabot/playwright-drupal/issues/97)) ([96668e9](https://github.com/Lullabot/playwright-drupal/commit/96668e985f85e11cf916a570f93885fa3f2bfea0))


### Bug Fixes

* make login() theme-agnostic ([#98](https://github.com/Lullabot/playwright-drupal/issues/98)) ([79306e5](https://github.com/Lullabot/playwright-drupal/commit/79306e5bdf3f16b50693d586634382339b7d8d31))
* set DRUPAL_DEV_SITE_PATH so drush recipe works in test isolation ([#99](https://github.com/Lullabot/playwright-drupal/issues/99)) ([fa94748](https://github.com/Lullabot/playwright-drupal/commit/fa94748e0db6daec02e7b2e855efa928669e75f3))

## [1.4.1](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.4.0...playwright-drupal-1.4.1) (2026-04-01)


### Bug Fixes

* pin mysql-to-sqlite3 to 2.5.5 due to regression in 2.5.6 ([6336542](https://github.com/Lullabot/playwright-drupal/commit/63365428393c3058256f6097c15d1568f5904448))

## [1.4.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.3.0...playwright-drupal-1.4.0) (2026-03-27)


### Features

* detect incorrect import from packages/ in config ([#89](https://github.com/Lullabot/playwright-drupal/issues/89)) ([3b4e132](https://github.com/Lullabot/playwright-drupal/commit/3b4e132d515be2942780cd0bde5110095763dafa))
* support TypeScript 6 ([#87](https://github.com/Lullabot/playwright-drupal/issues/87)) ([987d6c3](https://github.com/Lullabot/playwright-drupal/commit/987d6c315c4ddf815c4a66caf75639778746dfe4))

## [1.3.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.2.0...playwright-drupal-1.3.0) (2026-03-23)


### Features

* add definePlaywrightDrupalConfig() config helper ([#77](https://github.com/Lullabot/playwright-drupal/issues/77)) ([4475def](https://github.com/Lullabot/playwright-drupal/commit/4475def0563fbda0ac018571e14253fdaf932552))
* add global mask support for visual diff screenshots ([#73](https://github.com/Lullabot/playwright-drupal/issues/73)) ([ae4b495](https://github.com/Lullabot/playwright-drupal/commit/ae4b495c85fe076906cea5cb86c0b3b29d3c83eb))
* add login helper utility ([#78](https://github.com/Lullabot/playwright-drupal/issues/78)) ([67cf077](https://github.com/Lullabot/playwright-drupal/commit/67cf077ae19c74385385e25818112f6a195c00bc))
* add mysql-to-sqlite conversion task ([#75](https://github.com/Lullabot/playwright-drupal/issues/75)) ([d4c4d5e](https://github.com/Lullabot/playwright-drupal/commit/d4c4d5e6bfc393826f1c9ac5adc32cf0231bb02b))


### Bug Fixes

* apply deprecation suppression during setup and test execution ([ed794a2](https://github.com/Lullabot/playwright-drupal/commit/ed794a28ba2f87c6bfc43ab609e932aabc55d5c7))
* suppress deprecation headers in test child sites ([1cda7b3](https://github.com/Lullabot/playwright-drupal/commit/1cda7b3af8a2be1e3e2eb845852f433eb06a4899))

## [1.2.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.1.0...playwright-drupal-1.2.0) (2026-03-16)


### Features

* add Mockable interface and mock integration to visualdiff ([7458990](https://github.com/Lullabot/playwright-drupal/commit/745899063da073deda6f01536516ece101a23701))
* add Vitest unit tests for YoutubeMock and iframe mock docs ([ac291f1](https://github.com/Lullabot/playwright-drupal/commit/ac291f15122fbbc852c5ec1e2442969fecc4c72e))
* add YoutubeMock class and package exports ([8819542](https://github.com/Lullabot/playwright-drupal/commit/88195423c055d4bcccd2247dc821a49b04c77636))
* detect docroot from composer.json instead of hardcoding web/ ([#59](https://github.com/Lullabot/playwright-drupal/issues/59)) ([9c5ba1b](https://github.com/Lullabot/playwright-drupal/commit/9c5ba1bca77d5923e4382726a511d1393fbe7552))

## [1.1.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.0.7...playwright-drupal-1.1.0) (2026-03-11)


### Features

* add local commit message enforcement with commitlint and husky ([1809ea5](https://github.com/Lullabot/playwright-drupal/commit/1809ea5bebf472d39c5f568c8aa09fb6c665fdfb))
* disable ACID compliance for faster tests ([eabdc0a](https://github.com/Lullabot/playwright-drupal/commit/eabdc0a00ddef793064b42251fff259d20b5fe8a))
* gitignore lib/, add files allowlist, and fix npm packaging ([#61](https://github.com/Lullabot/playwright-drupal/issues/61)) ([35643c5](https://github.com/Lullabot/playwright-drupal/commit/35643c5c9d9c40c056292738bca3b870aff83d00))
* run pre-commit tests only when testable files are staged ([eb57ec0](https://github.com/Lullabot/playwright-drupal/commit/eb57ec0fb380654554e57843a06c4378b5059036))


### Bug Fixes

* add Playwright 1.56+ compatibility ([13e18ad](https://github.com/Lullabot/playwright-drupal/commit/13e18ad8aad7d086f881cd635d48fe6da771de2b))
* add repository URL for npm provenance ([#63](https://github.com/Lullabot/playwright-drupal/issues/63)) ([5db4fd6](https://github.com/Lullabot/playwright-drupal/commit/5db4fd6fe9e33bdea0103ed313d2d778d0f01ec4))
* corrupt cache tables when generating cookie strings ([cb7d1fa](https://github.com/Lullabot/playwright-drupal/commit/cb7d1fa4c601df3df21d81de7e7ee35ba19bcdd3))
* **deps:** update dependency @types/node to v24 ([#28](https://github.com/Lullabot/playwright-drupal/issues/28)) ([acc9a98](https://github.com/Lullabot/playwright-drupal/commit/acc9a98d0238652b0223ce596917e8e7c34b2412))
* use correct CLAUDECODE env var (no underscore) in pre-commit hook ([6437d8b](https://github.com/Lullabot/playwright-drupal/commit/6437d8ba280a44d4bcafe90b445fa54486bca5f7))

## [1.1.0](https://github.com/Lullabot/playwright-drupal/compare/playwright-drupal-1.0.7...playwright-drupal-1.1.0) (2026-03-10)


### Features

* add local commit message enforcement with commitlint and husky ([1809ea5](https://github.com/Lullabot/playwright-drupal/commit/1809ea5bebf472d39c5f568c8aa09fb6c665fdfb))
* disable ACID compliance for faster tests ([eabdc0a](https://github.com/Lullabot/playwright-drupal/commit/eabdc0a00ddef793064b42251fff259d20b5fe8a))
* gitignore lib/, add files allowlist, and fix npm packaging ([#61](https://github.com/Lullabot/playwright-drupal/issues/61)) ([35643c5](https://github.com/Lullabot/playwright-drupal/commit/35643c5c9d9c40c056292738bca3b870aff83d00))
* run pre-commit tests only when testable files are staged ([eb57ec0](https://github.com/Lullabot/playwright-drupal/commit/eb57ec0fb380654554e57843a06c4378b5059036))


### Bug Fixes

* add Playwright 1.56+ compatibility ([13e18ad](https://github.com/Lullabot/playwright-drupal/commit/13e18ad8aad7d086f881cd635d48fe6da771de2b))
* corrupt cache tables when generating cookie strings ([cb7d1fa](https://github.com/Lullabot/playwright-drupal/commit/cb7d1fa4c601df3df21d81de7e7ee35ba19bcdd3))
* **deps:** update dependency @types/node to v24 ([#28](https://github.com/Lullabot/playwright-drupal/issues/28)) ([acc9a98](https://github.com/Lullabot/playwright-drupal/commit/acc9a98d0238652b0223ce596917e8e7c34b2412))
* use correct CLAUDECODE env var (no underscore) in pre-commit hook ([6437d8b](https://github.com/Lullabot/playwright-drupal/commit/6437d8ba280a44d4bcafe90b445fa54486bca5f7))
