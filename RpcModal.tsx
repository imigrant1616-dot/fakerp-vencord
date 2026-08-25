import { Flex } from "@components/Flex";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { RenderModalProps } from "@vencord/discord-types";
import { Button, Modal, openModal, TextInput, useRef, useState } from "@webpack/common";
import Settings from "./settings";

export function parseTimeStringToMs(timeStr: string): number {
    if (!timeStr) return 0;
    const trimmed = timeStr.trim().toLowerCase();

    const hMatch = trimmed.match(/(\d+)\s*h/);
    const mMatch = trimmed.match(/(\d+)\s*m/);
    const sMatch = trimmed.match(/(\d+)\s*s/);

    if (hMatch || mMatch || sMatch) {
        const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
        const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
        const seconds = sMatch ? parseInt(sMatch[1], 10) : 0;
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    const colonParts = trimmed.split(":").map(p => parseInt(p.trim(), 10));
    if (colonParts.every(n => !isNaN(n))) {
        if (colonParts.length === 3) {
            return (colonParts[0] * 3600 + colonParts[1] * 60 + colonParts[2]) * 1000;
        }
        if (colonParts.length === 2) {
            return (colonParts[0] * 60 + colonParts[1]) * 1000;
        }
    }

    return 0;
}

// Uniwersalny parser dla dowolnych linków z Google, Imgura, Tenora, Giphy, CDNa itp.
export function cleanAndResolveMediaUrl(inputUrl: string): string {
    if (!inputUrl) return "";
    let url = inputUrl.trim().replace(/^["']|["']$/g, "");

    // 1. Google Images (np. z parametrem imgurl)
    if (url.includes("google.") && url.includes("imgurl=")) {
        try {
            const parsed = new URL(url);
            const imgurl = parsed.searchParams.get("imgurl");
            if (imgurl) {
                url = decodeURIComponent(imgurl);
            }
        } catch {}
    }

    // 2. Imgur (np. https://imgur.com/xyz)
    if (url.includes("imgur.com") && !url.includes("i.imgur.com")) {
        const cleanId = url.replace(/https?:\/\/(www\.)?imgur\.com\/(gallery\/|a\/)?/, "").split("/")[0].split(".")[0].split("?")[0];
        if (cleanId && cleanId.length >= 4) {
            url = `https://i.imgur.com/${cleanId}.gif`;
        }
    }

    // 3. Giphy (np. https://giphy.com/gifs/cat-123456)
    if (url.includes("giphy.com/gifs/")) {
        const id = url.split("-").pop()?.split("/")[0];
        if (id) {
            url = `https://i.giphy.com/media/${id}/giphy.gif`;
        }
    }

    // 4. Tenor (np. https://tenor.com/view/xxx-gif-12345)
    if (url.includes("tenor.com/view/") && !url.includes(".gif")) {
        const match = url.match(/gif-(\d+)/) || url.match(/-(\d+)$/);
        if (match && match[1]) {
            url = `https://c.tenor.com/${match[1]}/tenor.gif`;
        }
    }

    return url;
}

async function uploadLocalFile(file: File | Blob): Promise<string> {
    const catboxForm = new FormData();
    catboxForm.append("reqtype", "fileupload");
    catboxForm.append("fileToUpload", file);

    try {
        const res = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: catboxForm
        });
        const text = await res.text();
        if (text && text.startsWith("http")) {
            return text.trim();
        }
    } catch (e) {
        console.warn("[FakeDiscordRP] Catbox upload error:", e);
    }

    const imgurForm = new FormData();
    imgurForm.append("image", file);

    try {
        const res = await fetch("https://api.imgur.com/3/image", {
            method: "POST",
            headers: {
                Authorization: "Client-ID e64f7b4946399b9"
            },
            body: imgurForm
        });
        const json = await res.json();
        if (json?.data?.link) {
            return json.data.link.replace("http://", "https://");
        }
    } catch (e) {
        console.warn("[FakeDiscordRP] Imgur fallback error:", e);
    }

    throw new Error("Nie udało się przesłać pliku. Wklej dowolny bezpośredni link.");
}

export function openRpcModal(onSave: () => void) {
    openModal(modalProps => (
        <RpcModal modalProps={modalProps} onSave={onSave} />
    ));
}

function RpcModal({ modalProps, onSave }: { modalProps: RenderModalProps; onSave: () => void; }) {
    const [mainText, setMainText] = useState(Settings.store.mainText);
    const [smallText, setSmallText] = useState(Settings.store.smallText);
    const [mediaUrl, setMediaUrl] = useState(Settings.store.mediaUrl);
    const [timeString, setTimeString] = useState(Settings.store.timeString);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);

    const [showCropper, setShowCropper] = useState(false);
    const [cropZoom, setCropZoom] = useState(1);
    const [cropOffsetX, setCropOffsetX] = useState(0);
    const [cropOffsetY, setCropOffsetY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const cropImgRef = useRef<HTMLImageElement | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadStatus("Wysyłanie pliku... ⏳");

        try {
            const url = await uploadLocalFile(file);
            setMediaUrl(url);
            setUploadStatus(`✅ Przesłano: ${file.name}`);
        } catch (err: any) {
            setUploadStatus(`❌ Błąd: ${err.message || "Nie udało się przesłać"}`);
        } finally {
            setUploading(false);
        }
    };

    const handleApplyCircleCrop = async () => {
        if (!cropImgRef.current || !mediaUrl) return;

        setUploading(true);
        setUploadStatus("Przycinanie w kółko... ⏳");

        try {
            const img = cropImgRef.current;
            const size = 512;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Błąd kontekstu Canvas");

            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const imgAspect = img.naturalWidth / img.naturalHeight;
            let drawW = size * cropZoom;
            let drawH = size * cropZoom;
            if (imgAspect > 1) {
                drawW = drawH * imgAspect;
            } else {
                drawH = drawW / imgAspect;
            }

            const drawX = (size - drawW) / 2 + cropOffsetX;
            const drawY = (size - drawH) / 2 + cropOffsetY;

            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Błąd canvas"))), "image/png");
            });

            const uploadedUrl = await uploadLocalFile(blob);
            setMediaUrl(uploadedUrl);
            setShowCropper(false);
            setUploadStatus("✅ Przycięto idealnie w kółko!");
        } catch (e: any) {
            setUploadStatus(`❌ Błąd przycinania: ${e.message || "Nie udało się"}`);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = (enable: boolean) => {
        Settings.store.mainText = mainText;
        Settings.store.smallText = smallText;
        Settings.store.mediaUrl = cleanAndResolveMediaUrl(mediaUrl);
        Settings.store.timeString = timeString;
        Settings.store.enabled = enable;

        onSave();
        modalProps.onClose();
    };

    return (
        <Modal
            {...modalProps}
            title="🎮 Fake Discord Rich Presence"
            subtitle="Ustaw własny status z dowolnym linkiem / plikiem, podpisem i odliczaniem czasu"
            actions={[
                {
                    text: "Wyłącz",
                    variant: "dangerSecondary",
                    onClick: () => handleSave(false)
                },
                {
                    text: "Anuluj",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: "Zapisz",
                    variant: "primary",
                    onClick: () => handleSave(true),
                    disabled: !mainText.trim() || uploading
                }
            ]}
        >
            <Flex flexDirection="column" gap={16} style={{ padding: "8px 0" }}>
                <section>
                    <HeadingSecondary>Główny text</HeadingSecondary>
                    <TextInput
                        value={mainText}
                        onChange={setMainText}
                        placeholder="np. Majnkraft"
                    />
                </section>

                <section>
                    <HeadingSecondary>Maly text</HeadingSecondary>
                    <TextInput
                        value={smallText}
                        onChange={setSmallText}
                        placeholder="np. Najlepszy klient pod wydajność"
                    />
                </section>

                <section>
                    <HeadingSecondary>grafika - mp4 mp3 .gif .jpg .png (Dowolny link z Google/Internetu lub plik)</HeadingSecondary>
                    
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,video/*,audio/*,.gif,.png,.jpg,.jpeg,.mp4,.mp3,.webp"
                        style={{ display: "none" }}
                    />

                    <Flex gap={8} alignItems="center" style={{ marginBottom: "8px" }}>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            📁 Wybierz plik / GIF z dysku
                        </Button>

                        {mediaUrl && (
                            <Button
                                size="small"
                                variant={showCropper ? "primary" : "secondary"}
                                onClick={() => setShowCropper(!showCropper)}
                                disabled={uploading}
                            >
                                ✂️ {showCropper ? "Zamknij kadrowanie" : "Dostosuj / Wytnij w kółko"}
                            </Button>
                        )}

                        {uploadStatus && (
                            <Paragraph style={{ fontSize: "13px", color: uploadStatus.startsWith("✅") ? "var(--status-positive)" : uploadStatus.startsWith("❌") ? "var(--status-danger)" : "var(--text-muted)" }}>
                                {uploadStatus}
                            </Paragraph>
                        )}
                    </Flex>

                    {showCropper && mediaUrl && (
                        <div style={{
                            background: "var(--background-secondary)",
                            padding: "12px",
                            borderRadius: "8px",
                            marginBottom: "12px",
                            border: "1px solid var(--background-modifier-accent)"
                        }}>
                            <Paragraph style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "8px" }}>
                                🔘 Dopasuj kółko (Przeciągnij myszką, aby przesunąć / użyj suwaka przybliżenia):
                            </Paragraph>

                            <div
                                style={{
                                    width: "200px",
                                    height: "200px",
                                    margin: "0 auto",
                                    borderRadius: "50%",
                                    overflow: "hidden",
                                    border: "3px solid #5865F2",
                                    boxShadow: "0 0 12px rgba(88, 101, 242, 0.5)",
                                    position: "relative",
                                    cursor: isDragging ? "grabbing" : "grab",
                                    background: "#000"
                                }}
                                onMouseDown={e => {
                                    setIsDragging(true);
                                    setDragStart({ x: e.clientX - cropOffsetX, y: e.clientY - cropOffsetY });
                                }}
                                onMouseMove={e => {
                                    if (!isDragging) return;
                                    setCropOffsetX(e.clientX - dragStart.x);
                                    setCropOffsetY(e.clientY - dragStart.y);
                                }}
                                onMouseUp={() => setIsDragging(false)}
                                onMouseLeave={() => setIsDragging(false)}
                            >
                                <img
                                    ref={cropImgRef}
                                    src={mediaUrl}
                                    crossOrigin="anonymous"
                                    alt="Kadrowanie"
                                    style={{
                                        position: "absolute",
                                        left: "50%",
                                        top: "50%",
                                        transform: `translate(calc(-50% + ${cropOffsetX}px), calc(-50% + ${cropOffsetY}px)) scale(${cropZoom})`,
                                        maxWidth: "100%",
                                        maxHeight: "100%",
                                        userSelect: "none",
                                        pointerEvents: "none"
                                    }}
                                />
                            </div>

                            <Flex gap={12} alignItems="center" justifyContent="center" style={{ marginTop: "12px" }}>
                                <span style={{ fontSize: "12px" }}>🔍 Zoom:</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.05"
                                    value={cropZoom}
                                    onChange={e => setCropZoom(parseFloat(e.target.value))}
                                    style={{ width: "140px", cursor: "pointer" }}
                                />
                                <Button
                                    size="small"
                                    variant="primary"
                                    onClick={handleApplyCircleCrop}
                                    disabled={uploading}
                                >
                                    ✅ Zastosuj kółko
                                </Button>
                            </Flex>
                        </div>
                    )}

                    <TextInput
                        value={mediaUrl}
                        onChange={(val: string) => setMediaUrl(cleanAndResolveMediaUrl(val))}
                        placeholder="Wklej dowolny link (z Google Grafika, Imgura, Tenora, Pinterest itp.)"
                    />

                    {mediaUrl && !showCropper && (
                        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                            <img
                                src={cleanAndResolveMediaUrl(mediaUrl)}
                                alt="Podgląd"
                                style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--background-modifier-accent)" }}
                                onError={e => (e.currentTarget.style.display = "none")}
                                onLoad={e => (e.currentTarget.style.display = "block")}
                            />
                            <Paragraph style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                Podgląd grafiki / GIFa
                            </Paragraph>
                        </div>
                    )}
                </section>

                <section>
                    <HeadingSecondary>czas</HeadingSecondary>
                    <TextInput
                        value={timeString}
                        onChange={setTimeString}
                        placeholder="np. 140h 30m 20s lub 1h"
                    />
                    <Paragraph style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Czas zacznie odliczać od podanej wartości w górę (np. 140h 30m 21s, 22s itd.).
                    </Paragraph>
                </section>
            </Flex>
        </Modal>
    );
}
