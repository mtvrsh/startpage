# Startpage

![GitHub License](https://img.shields.io/github/license/imjah/startpage?style=flat-square&logo=gnu&label=License&labelColor=282828&color=689d6a)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/imjah/startpage/deploy.yml?style=flat-square&logo=github&label=Deploy&labelColor=282828&color=689d6a)
![GitHub last commit](https://img.shields.io/github/last-commit/imjah/startpage?style=flat-square&label=Last%20commit&labelColor=282828&color=689d6a)

![Screenshot](.github/screenshot.webp)

A [startpage](https://reddit.com/r/startpages/) with lightweight and privacy-friendly YouTube feed built with [Piped API](https://github.com/TeamPiped/Piped).

# Open videos in app feature

You can configure Startpage to open videos in a desktop app like `mpv` via
[custom protocol](https://kb.mozillazine.org/Register_protocol).

1. In `about:config` create `boolean` variable
   `network.protocol-handler.expose.mpv` with `false` value

2. Create launcher

```sh
#!/bin/bash

mpv "${1/mpv:/}"
```

3. In [settings](https://imjah.github.io/startpage/settings) enable
   `Open videos in app`

4. Click any link and select launcher from step 2
