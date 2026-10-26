# V5 screenshot comparison, 21 October 2026

Native captures are from the running iPad Pro 13-inch (M5), iOS 26.1. Source references are the supplied landscape JPEG exports.

- `orders-header-comparison.png`: design, app before, app after. The simulator bezel is cropped and the app viewport is resized to the reference1366×1024 before taking the header strip. This exposed the missing divider and missing tab gaps/count badge padding.
- `salt-modal-comparison.png`: design, app before, app after. Modal crops are presented at the same620-unit width, preserving aspect ratio and adding background where required. This exposed the old Paper dialog framing.
- `item-note-after.png`: native evidence for the horizontal presets, external label, rounded field, shared header and footer after correction.
- Raw native captures remain beside the comparisons.

The app uses current backend data, existing local tile appearance and conditional actions. Reference fixture names, counts, dates and salt selections are not copied into the app. The retained marketplace status action and conditional Pre-orders tab explain additional header controls. No pixel similarity percentage is reported because those dynamic differences would make it misleading.

These comparisons verify the recorded iPad states. They do not certify all116 reference states or phone/Android runtime. Native font rasterization and backdrop tint still differ from the browser-rendered references (native blur is not implemented).
