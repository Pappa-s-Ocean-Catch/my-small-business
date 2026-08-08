# Native Raw-TCP Printer Verification

Native raw-TCP remains disabled by default. Record one row per fixture and platform before selecting `native-enabled`.

| Platform | Build | Mode | Fixture | Native/JS fingerprint | Receipt visual result | Capture ms | Resize ms | Raster ms | Send ms | Total ms | Approved by |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Android | Pending tablet test | native-diagnostic | black/white | Pending | JS-only receipt pending | | | | | | |
| Android | Pending tablet test | native-diagnostic | alpha | Pending | JS-only receipt pending | | | | | | |
| Android | Pending tablet test | native-diagnostic | long receipt / 58 mm / 80 mm | Pending | JS-only receipt pending | | | | | | |
| iOS | Pending tablet test | native-diagnostic | black/white | Pending | JS-only receipt pending | | | | | | |
| iOS | Pending tablet test | native-diagnostic | alpha | Pending | JS-only receipt pending | | | | | | |
| iOS | Pending tablet test | native-diagnostic | long receipt / 58 mm / 80 mm | Pending | JS-only receipt pending | | | | | | |

Only after diagnostic and visual evidence is recorded may the corresponding platform setting be changed to `native-enabled`. A native error or mismatched fingerprint requires returning that platform to `js-only` and using the JavaScript fallback.
