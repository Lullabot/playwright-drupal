# Changelog

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
