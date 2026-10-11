# Two Phone Speaker

Use one phone as the screen and a second phone as the speaker. Open `index.html`
on both phones (it must be served over the web, e.g. GitHub Pages).

1. Phone A (louder speaker): tap **SPEAKER** — it shows a 4-digit code.
2. Phone B (has the video): tap **SCREEN**, enter the code, choose a video file, tap **Connect & play**.

Audio is streamed peer-to-peer (WebRTC via PeerJS) from the screen phone to the speaker phone.
Limitation: it plays video *files* stored on the screen phone. Apps like YouTube/TikTok/Netflix can't be captured by a mobile browser.
