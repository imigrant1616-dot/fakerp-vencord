import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export default definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Włącz / Wyłącz Fake Discord Rich Presence",
    },
    mainText: {
        type: OptionType.STRING,
        default: "Majnkraft",
        description: "Główny tekst (Nazwa gry / aplikacji)",
    },
    smallText: {
        type: OptionType.STRING,
        default: "majnkraft playing",
        description: "Mały tekst (Podpis / Szczegóły)",
    },
    mediaUrl: {
        type: OptionType.STRING,
        default: "https://i.imgur.com/8Q3u1tC.png",
        description: "Grafika (Link do .gif, .mp4, .png, .jpg itp.)",
    },
    timeString: {
        type: OptionType.STRING,
        default: "1h",
        description: "Czas (np. 140h 30m 20s, 1h lub 43:04)",
    }
});
