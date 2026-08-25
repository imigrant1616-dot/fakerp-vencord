import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { ApplicationCommandInputType } from "@api/Commands";
import { getUserSettingLazy } from "@api/UserSettings";
import definePlugin, { IconComponent } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import { ActivityType } from "@vencord/discord-types/enums";
import { findByProps, findStore } from "@webpack";
import { ApplicationAssetUtils, FluxDispatcher, React, RunningGameStore, UserStore } from "@webpack/common";
import { cleanAndResolveMediaUrl, openRpcModal, parseTimeStringToMs } from "./RpcModal";
import Settings from "./settings";

const DEFAULT_APP_ID = "1108588077900898414";
const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame");

let refreshInterval: any = null;
let originalGetActivities: any = null;
let originalGetPrimaryActivity: any = null;
let originalGetRunningGames: any = null;
let originalGetVisibleGame: any = null;

const GamepadIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg
        width={width}
        height={height}
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 12h4m-2-2v4m9-3h.01m2 2h.01" />
    </svg>
);

const RpcChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip="Fake DiscordRP (Zmień status / czas)"
            onClick={() => openRpcModal(() => updateActivity(false))}
        >
            <GamepadIcon />
        </ChatBarButton>
    );
};

function getPresenceStore(): any {
    return findStore("PresenceStore") || findByProps("getActivities", "getPrimaryActivity");
}

function hookStores() {
    try {
        const pStore = getPresenceStore();
        if (pStore && !pStore.__fakeRPHooked) {
            originalGetActivities = pStore.getActivities;
            originalGetPrimaryActivity = pStore.getPrimaryActivity;

            pStore.getActivities = function (userId: string, ...args: any[]) {
                const myId = UserStore?.getCurrentUser?.()?.id;

                if (Settings.store.enabled && myId && userId === myId) {
                    const original = originalGetActivities ? originalGetActivities.apply(this, [userId, ...args]) : [];
                    const customStatus = Array.isArray(original) ? original.find((a: any) => a?.type === ActivityType.CUSTOM_STATUS) : null;
                    const fakeAct = Array.isArray(original) ? original.find((a: any) => a?.name === Settings.store.mainText || a?.application_id === DEFAULT_APP_ID) : null;

                    const result: any[] = [];
                    if (fakeAct) result.push(fakeAct);
                    if (customStatus) result.push(customStatus);

                    return result;
                }
                return originalGetActivities ? originalGetActivities.apply(this, [userId, ...args]) : [];
            };

            pStore.getPrimaryActivity = function (userId: string, ...args: any[]) {
                const myId = UserStore?.getCurrentUser?.()?.id;
                if (Settings.store.enabled && myId && userId === myId) {
                    const activities = originalGetActivities ? originalGetActivities.apply(this, [userId, ...args]) : [];
                    const fakeAct = Array.isArray(activities) ? activities.find((a: any) => a?.name === Settings.store.mainText || a?.application_id === DEFAULT_APP_ID) : null;
                    if (fakeAct) return fakeAct;
                }
                return originalGetPrimaryActivity ? originalGetPrimaryActivity.apply(this, [userId, ...args]) : null;
            };

            pStore.__fakeRPHooked = true;
        }
    } catch (e) {
        console.warn("[FakeDiscordRP] PresenceStore hook warning:", e);
    }

    try {
        const gStore = RunningGameStore || findStore("RunningGameStore") || findByProps("getRunningGames", "getVisibleGame");
        if (gStore && !gStore.__fakeRPHooked) {
            originalGetRunningGames = gStore.getRunningGames;
            originalGetVisibleGame = gStore.getVisibleGame;

            gStore.getRunningGames = function (...args: any[]) {
                if (Settings.store.enabled) {
                    return [];
                }
                return originalGetRunningGames ? originalGetRunningGames.apply(this, args) : [];
            };

            gStore.getVisibleGame = function (...args: any[]) {
                if (Settings.store.enabled) {
                    return null;
                }
                return originalGetVisibleGame ? originalGetVisibleGame.apply(this, args) : null;
            };

            gStore.__fakeRPHooked = true;
        }
    } catch (e) {
        console.warn("[FakeDiscordRP] RunningGameStore hook warning:", e);
    }
}

function formatAssetUrl(url: string): string {
    if (!url) return "";
    const clean = cleanAndResolveMediaUrl(url);
    if (clean.startsWith("mp:external/")) return clean;
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
        return `mp:external/${btoa(clean)}/${encodeURIComponent(clean)}`;
    }
    return clean;
}

export async function createActivity(): Promise<Activity | null> {
    const {
        mainText,
        smallText,
        mediaUrl,
        timeString
    } = Settings.store;

    if (!mainText || !mainText.trim()) return null;

    try {
        if (ShowCurrentGame && !ShowCurrentGame.getSetting()) {
            ShowCurrentGame.updateSetting(true);
        }
    } catch {}

    const elapsedMs = parseTimeStringToMs(timeString);

    const activity: Activity = {
        application_id: DEFAULT_APP_ID,
        name: mainText.trim(),
        details: smallText && smallText.trim() ? smallText.trim() : undefined,
        type: ActivityType.PLAYING,
        flags: 1 << 0,
        timestamps: {
            start: elapsedMs > 0 ? (Date.now() - elapsedMs) : Date.now()
        }
    };

    if (mediaUrl && mediaUrl.trim()) {
        const cleaned = cleanAndResolveMediaUrl(mediaUrl);
        let assetKey = cleaned;

        try {
            if (ApplicationAssetUtils?.fetchAssetIds) {
                const fetched = (await ApplicationAssetUtils.fetchAssetIds(DEFAULT_APP_ID, [cleaned]))[0];
                if (fetched) assetKey = fetched;
            }
        } catch {}

        if (!assetKey.startsWith("mp:external") && (assetKey.startsWith("http://") || assetKey.startsWith("https://"))) {
            assetKey = formatAssetUrl(assetKey);
        }

        activity.assets = {
            large_image: assetKey,
            large_text: mainText.trim()
        };
    }

    for (const k in activity) {
        if (k === "type" || k === "flags") continue;
        const v = (activity as any)[k];
        if (!v) delete (activity as any)[k];
    }

    return activity;
}

export async function updateActivity(disable = false) {
    if (disable || !Settings.store.enabled) {
        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            activity: null,
            socketId: "FakeDiscordRP"
        });
        return;
    }

    const activity = await createActivity();
    
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity: null,
        socketId: "FakeDiscordRP"
    });

    if (activity) {
        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            activity,
            socketId: "FakeDiscordRP"
        });
        console.log("[FakeDiscordRP] Status zaktualizowany na profilu:", activity);
    }
}

export default definePlugin({
    name: "FakeDiscordRP",
    description: "Ustaw własny Fake Rich Presence z wykluczaniem innych gier i obsługą dowolnych linków z Google/Internetu.",
    authors: [{ name: "Jimothy Prompter & wreck user", id: 0n }],
    settings: Settings,

    chatBarButton: {
        icon: GamepadIcon,
        render: RpcChatBarButton
    },

    commands: [
        {
            name: "fakerp",
            description: "Otwórz okno konfiguracji Fake Discord Rich Presence",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: async () => {
                openRpcModal(() => updateActivity(false));
            }
        }
    ],

    start() {
        hookStores();
        if (Settings.store.enabled) {
            updateActivity(false);
        }

        refreshInterval = setInterval(() => {
            hookStores();
            if (Settings.store.enabled) {
                updateActivity(false);
            }
        }, 6000);
    },

    stop() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        const pStore = getPresenceStore();
        if (pStore) {
            if (originalGetActivities) pStore.getActivities = originalGetActivities;
            if (originalGetPrimaryActivity) pStore.getPrimaryActivity = originalGetPrimaryActivity;
            delete pStore.__fakeRPHooked;
        }
        const gStore = RunningGameStore || findStore("RunningGameStore");
        if (gStore) {
            if (originalGetRunningGames) gStore.getRunningGames = originalGetRunningGames;
            if (originalGetVisibleGame) gStore.getVisibleGame = originalGetVisibleGame;
            delete gStore.__fakeRPHooked;
        }
        updateActivity(true);
    }
});
