# Open your desktop vault on your phone

Paintwarden's desktop app can share its **local vault** with your other devices. This is off by default. Your computer must stay awake with Paintwarden running; your phone uses the same vault, not a second copy.

1. Finish account setup in the desktop app. Remember that account's username and password.
2. Open **Settings → Allow access from my other devices** and turn it on. This setting is available only when the desktop app uses **this computer**, not a remote server.
3. If macOS asks whether to allow incoming connections, choose **Allow** for Paintwarden's bundled server. This normally happens on the first enable; macOS controls the prompt and may ask again after updates or firewall changes. If blocked, review **System Settings → Network → Firewall → Options**. Do not turn off the firewall.
4. Put your phone on the same Wi-Fi, or connect both devices to your Tailscale network. Select a reachable address in Settings, then scan its QR code with your phone's camera. You can also copy the address and open it manually. The QR is generated on your computer and contains only the address, never your password or session.
5. Sign in on your phone with the **same Paintwarden account**. Phone access always requires sign-in, even if you have disabled sign-in for the desktop vault. Your miniatures, images, uploads, live changes and Swatch Scan use the existing responsive web interface.
6. Turn the setting off to stop network access immediately, including live connections. The desktop app keeps working. The selected network port is saved separately from your vault; if it is already taken, Paintwarden chooses and saves another port. Use the new address/QR if the port changes.

![Desktop Settings showing phone access and a locally generated QR code](images/phone-access-settings.png)

*Illustration with sample addresses and a sample QR; your addresses will differ.*

**Network warning:** anyone who can reach your computer on the network can reach the login page. Plain HTTP does not encrypt your password or vault traffic. Use only a trusted network, or use Tailscale (which encrypts traffic between your devices). Guest Wi-Fi or client isolation may prevent devices from reaching each other. A VPN, sleeping computer or changed Wi-Fi address can also make an old QR stop working; reopen Settings to refresh the addresses. Do not forward this port from your router to the public Internet.

## Optional HTTPS with Tailscale Serve

Plain-HTTP LAN pages may have limited **Add to Home Screen**, camera and other browser features. Tailscale's direct `100.x` address is still an HTTP browser origin, even though Tailscale encrypts its network traffic.

For a browser HTTPS origin, first install/sign in to Tailscale on both devices and enable MagicDNS/HTTPS for your tailnet. With Paintwarden's phone access enabled, copy the **Tailscale Serve** command shown in Settings. It looks like this (replace the port with the one Settings shows):

```sh
tailscale serve http://127.0.0.1:48177
```

Run it yourself in Terminal, review any Tailscale confirmation, then open the **HTTPS MagicDNS URL printed by Tailscale** on your phone. Sign in normally. Paintwarden never runs Serve or changes your Tailscale configuration automatically. Only your detected MagicDNS name is accepted for this local HTTPS proxy. If it was not detected, make sure Tailscale is connected and reopen Settings before trying Serve. Tailscale Serve must run on the same computer as Paintwarden; another reverse proxy is not supported by this desktop feature.

When finished, turn phone access off in Paintwarden; this stops access through Serve too. You can also remove the Tailscale Serve configuration yourself with `tailscale serve reset` (this resets other Serve routes on that computer too, so review your configuration first).

This feature does not change HTTPS cookies or proxy settings for Docker/server deployments.
