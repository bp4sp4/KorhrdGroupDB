"use client";
import styles from "./finder.module.css";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import REGIONS from "./region";
import Dropdown from "./Dropdown";
import NaverMapView from "./NaverMapView";
import { useUserLocation } from "./useUserLocation";
import type { LatLng, MapItem } from "./types";

const DEFAULT_CENTER: LatLng = { latitude: 37.5665, longitude: 126.978 };
const LAW_OPTIONS = ["전체", "구법", "신법", "구법+신법"];

function toHref(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// 짧은 이름 (지도 핀 라벨용)
function shortName(name: string): string {
  const n = (name || "").trim();
  return n.length > 11 ? `${n.slice(0, 10)}…` : n;
}

// 두 좌표 간 거리(km) — Haversine
function distanceKm(a: LatLng, lat: number, lng: number): number {
  const R = 6371;
  const dLat = ((lat - a.latitude) * Math.PI) / 180;
  const dLng = ((lng - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function distLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

export default function PracticeAgencyPage() {
  const [supabase] = useState(createClient);

  const [mode, setMode] = useState<"교육원" | "현장실습기관">("교육원");
  const [region, setRegion] = useState("");
  const [subregion, setSubregion] = useState("");
  const [law, setLaw] = useState("전체");
  const [hasSearched, setHasSearched] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [centers, setCenters] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [sortMode, setSortMode] = useState<"default" | "distance">("default");

  const { locationState, detectGPS, geocodeAddress, clearLocation } =
    useUserLocation();
  const userLocation: LatLng = locationState.coords ?? DEFAULT_CENTER;

  // 기본(미검색) 목록
  useEffect(() => {
    setSelected(null);
    if (hasSearched) return;
    const run = async () => {
      setLoading(true);
      try {
        if (mode === "교육원") {
          const { data } = await supabase
            .from("training_centers")
            .select("*")
            .limit(50);
          setCenters(data || []);
          setInstitutions([]);
        } else {
          const { data } = await supabase
            .from("training_institution")
            .select("*")
            .limit(50);
          setInstitutions(data || []);
          setCenters([]);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasSearched]);

  // 교육원 검색
  useEffect(() => {
    if (!hasSearched || mode !== "교육원") return;
    setLoading(true);
    setSelected(null);
    let query = supabase.from("training_centers").select("*");
    if (region)
      query = query.or(`province.eq.${region},available_region.ilike.%전국%`);
    if (subregion)
      query = query.or(`region.eq.${subregion},available_region.ilike.%전국%`);
    if (law !== "전체") query = query.eq("law_type", law);
    query.limit(300).then(({ data }) => {
      setCenters(data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, subregion, law, mode, hasSearched]);

  // 현장실습기관 검색
  useEffect(() => {
    if (!hasSearched || mode !== "현장실습기관") return;
    setLoading(true);
    setSelected(null);
    let query = supabase.from("training_institution").select("*");
    if (region) query = query.ilike("full_address", `%${region}%`);
    if (subregion) query = query.ilike("full_address", `%${subregion}%`);
    query.limit(300).then(({ data }) => {
      setInstitutions(data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, subregion, mode, hasSearched]);

  const list = mode === "교육원" ? centers : institutions;

  // 정렬된 목록 — 메모이즈(렌더마다 재생성 방지)
  const sortedList = useMemo(() => {
    if (sortMode !== "distance") return list;
    return [...list].sort((a, b) => {
      const da =
        a.latitude != null
          ? distanceKm(userLocation, a.latitude, a.longitude)
          : Infinity;
      const db =
        b.latitude != null
          ? distanceKm(userLocation, b.latitude, b.longitude)
          : Infinity;
      return da - db;
    });
  }, [list, sortMode, userLocation]);

  // 지도 마커 — 현재 위치 기준 가까운 순으로, 기관은 40개·교육원은 150개까지만
  const markerCap = mode === "현장실습기관" ? 40 : 150;
  const mapItems: MapItem[] = useMemo(
    () =>
      sortedList
        .filter((r) => r.latitude != null && r.longitude != null)
        .slice()
        .sort(
          (a, b) =>
            distanceKm(userLocation, a.latitude, a.longitude) -
            distanceKm(userLocation, b.latitude, b.longitude),
        )
        .slice(0, markerCap)
        .map((r) => ({
          id: r.id,
          name: mode === "교육원" ? r.institute_name : r.name,
          label: shortName(mode === "교육원" ? r.institute_name : r.name),
          badge: mode === "교육원" ? r.law_type || undefined : undefined,
          address: (mode === "교육원" ? r.address : r.full_address) ?? "",
          contact: r.contact ?? null,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          type:
            mode === "교육원"
              ? r.category || "교육원"
              : r.institution_type || "기관",
          regionText:
            mode === "교육원"
              ? r.available_region || r.address || ""
              : r.full_address || "",
          lawType: mode === "교육원" ? r.law_type || undefined : undefined,
        })),
    [sortedList, mode, markerCap, userLocation],
  );

  const onRegion = (v: string) => {
    setRegion(v);
    setSubregion("");
    setHasSearched(true);
  };
  const onSubregion = (v: string) => {
    setSubregion(v);
    setHasSearched(true);
  };
  const onLaw = (v: string) => {
    setLaw(v);
    setHasSearched(true);
  };
  const resetFilters = () => {
    setRegion("");
    setSubregion("");
    setLaw("전체");
    setHasSearched(false);
  };

  const subregionList = region ? REGIONS[region] || [] : [];

  return (
    <div className={styles.finder}>
      {/* 좌측: 필터 + 리스트 */}
      <div className={styles.leftPanel}>
        <div className={styles.filterBox}>
          <div className={styles.toggleWrap}>
            <button
              className={`${styles.toggle} ${mode === "교육원" ? styles.toggleActive : ""}`}
              onClick={() => {
                setMode("교육원");
                setHasSearched(false);
              }}
            >
              교육원 찾기
            </button>
            <button
              className={`${styles.toggle} ${mode === "현장실습기관" ? styles.toggleActive : ""}`}
              onClick={() => {
                setMode("현장실습기관");
                setHasSearched(false);
              }}
            >
              현장실습기관 찾기
            </button>
          </div>

          <div className={styles.selectRow}>
            <Dropdown
              value={region}
              placeholder="시/도"
              onChange={onRegion}
              options={[
                { value: "", label: "전체" },
                ...Object.keys(REGIONS).map((r) => ({ value: r, label: r })),
              ]}
            />
            <Dropdown
              value={subregion}
              placeholder="시/군/구"
              disabled={!region}
              onChange={onSubregion}
              options={[
                { value: "", label: "전체" },
                ...subregionList.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          {/* 위치 검색 */}
          <div className={styles.locGroup}>
            <div className={styles.locRow}>
              <button
                type="button"
                className={`${styles.locBtn} ${locationState.source === "gps" ? styles.locBtnActive : ""}`}
                onClick={detectGPS}
                disabled={locationState.isLoading}
              >
                ◎ 내 위치
              </button>
              <input
                className={styles.locInput}
                placeholder="주소 입력 (예: 서울시 강남구)"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addressInput.trim())
                    geocodeAddress(addressInput.trim());
                }}
              />
              <button
                type="button"
                className={styles.locSearch}
                onClick={() =>
                  addressInput.trim() && geocodeAddress(addressInput.trim())
                }
              >
                검색
              </button>
            </div>
            {locationState.coords && (
              <div className={styles.locStatus}>
                <b>
                  {locationState.source === "gps"
                    ? "현재 위치 사용 중"
                    : locationState.addressText}
                </b>
                <button
                  type="button"
                  className={styles.reset}
                  onClick={clearLocation}
                >
                  해제
                </button>
              </div>
            )}
            {locationState.error && (
              <div className={styles.locStatus}>{locationState.error}</div>
            )}
          </div>

          {/* 적용 법령 (교육원만) */}
          {mode === "교육원" && (
            <div className={styles.lawGroup}>
              <div className={styles.lawHead}>
                <span className={styles.lawTitle}>적용 법령</span>
                <button className={styles.reset} onClick={resetFilters}>
                  ↻ 초기화
                </button>
              </div>
              <div className={styles.chips}>
                {LAW_OPTIONS.map((o) => (
                  <div
                    key={o}
                    className={`${styles.chip} ${law === o ? styles.chipOn : ""}`}
                    onClick={() => onLaw(o)}
                  >
                    {o}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.listHead}>
          <div className={styles.listCount}>
            검색 결과 <b>{list.length.toLocaleString()}</b>곳
          </div>
          <Dropdown
            value={sortMode}
            wrapClassName={styles.ddSort}
            onChange={(v) => setSortMode(v as "default" | "distance")}
            options={[
              { value: "default", label: "정확도순" },
              { value: "distance", label: "거리순" },
            ]}
          />
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>불러오는 중...</div>
          ) : list.length === 0 ? (
            <div className={styles.empty}>검색 결과가 없습니다.</div>
          ) : mode === "교육원" ? (
            sortedList.map((it) => {
              const sel = it.id === selected;
              return (
                <div
                  key={it.id}
                  className={
                    sel ? `${styles.card} ${styles.cardSel}` : styles.card
                  }
                  onClick={() => setSelected(sel ? null : it.id)}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardName}>{it.institute_name}</span>
                    <span className={styles.typeBadge}>
                      {it.category || "교육원"}
                    </span>
                    {locationState.coords && it.latitude != null && (
                      <span className={styles.distBadge}>
                        {distLabel(
                          distanceKm(userLocation, it.latitude, it.longitude),
                        )}
                      </span>
                    )}
                  </div>
                  <div className={styles.cardFields}>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>실습 가능 지역</span>
                      <span className={styles.fieldValue}>
                        {it.available_region || "-"}
                      </span>
                    </div>
                    {it.law_type && (
                      <div className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>적용 법령</span>
                        <span
                          className={
                            it.law_type === "신법"
                              ? styles.lawPill
                              : `${styles.lawPill} ${styles.lawPillOld}`
                          }
                        >
                          {it.law_type}
                        </span>
                      </div>
                    )}
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>연락처</span>
                      <span className={styles.fieldValueStrong}>
                        {it.contact || "-"}
                      </span>
                    </div>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>주소</span>
                      <span className={styles.fieldValue}>
                        {it.address || "-"}
                      </span>
                    </div>
                  </div>
                  {it.note && (
                    <div className={styles.noteBox}>
                      <b>비고</b> · {it.note}
                    </div>
                  )}
                  <div className={styles.cardActions}>
                    {it.link && (
                      <a
                        className={styles.actionGhost}
                        href={toHref(it.link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ↗ 홈페이지
                      </a>
                    )}
                    <button
                      type="button"
                      className={styles.actionPrimary}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(it.id);
                      }}
                    >
                      ◉ 지도에서 보기
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            sortedList.map((it) => {
              const sel = it.id === selected;
              return (
                <div
                  key={it.id}
                  className={
                    sel ? `${styles.card} ${styles.cardSel}` : styles.card
                  }
                  onClick={() => setSelected(sel ? null : it.id)}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardName}>{it.name}</span>
                    <span className={styles.typeBadge}>
                      {it.institution_type || "기관"}
                    </span>
                    {locationState.coords && it.latitude != null && (
                      <span className={styles.distBadge}>
                        {distLabel(
                          distanceKm(userLocation, it.latitude, it.longitude),
                        )}
                      </span>
                    )}
                  </div>
                  <div className={styles.cardFields}>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>연락처</span>
                      <span className={styles.fieldValueStrong}>
                        {it.contact || "-"}
                      </span>
                    </div>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>주소</span>
                      <span className={styles.fieldValue}>
                        {it.full_address || "-"}
                      </span>
                    </div>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>선정유효기간</span>
                      <span className={styles.fieldValue}>
                        {it.selection_period || "-"}
                      </span>
                    </div>
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>실습비</span>
                      <span className={styles.fieldValue}>
                        {it.cost
                          ? `${Number(it.cost).toLocaleString()}원`
                          : "-"}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.actionPrimary}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(it.id);
                      }}
                    >
                      ◉ 지도에서 보기
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 우측: 지도 */}
      <div className={styles.mapPanel}>
        <NaverMapView
          userLocation={userLocation}
          items={mapItems}
          selectedId={selected}
          onSelect={(id) => setSelected(id)}
          showUserMarker={!!locationState.coords}
        />
      </div>
    </div>
  );
}
