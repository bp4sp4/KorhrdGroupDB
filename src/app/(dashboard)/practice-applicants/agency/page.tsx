"use client";
import styles from "./finder.module.css";
import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import REGIONS from "./region";
import Dropdown from "./Dropdown";
import NaverMapView from "./NaverMapView";
import { useUserLocation } from "./useUserLocation";
import type { LatLng, MapItem } from "./types";

const DEFAULT_CENTER: LatLng = { latitude: 37.5665, longitude: 126.978 };

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

// 검색 입력 좌측 돋보기 아이콘
function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// 분 → "N분" / "N시간 M분"
function fmtDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

interface RouteLeg {
  durationMin: number;
  distanceM: number;
}
interface RouteInfo {
  car: RouteLeg | null;
  walk: RouteLeg | null;
}

interface StudentHit {
  id: number;
  name: string | null;
  contact: string | null;
  address: string | null;
  birth_date?: string | null;
  gender?: string | null;
  status?: string | null;
  practice_type?: string | null;
  desired_date?: string | null;
  desired_weekday?: string | null;
  desired_semester?: string | null;
  recognition_period?: string | null;
  training_center?: string | null;
  field_institution?: string | null;
  own_car?: string | null;
  manager?: string | null;
  counsel_content?: string | null;
}

// "걸리는 시간" 값 — 미선택/출발지 없음: "-", 계산 중, 차로/도보 결과
function etaDisplay(args: {
  active: boolean;
  loading: boolean;
  route: RouteInfo | null;
}): string {
  if (!args.active) return "-";
  if (args.loading) return "계산 중…";
  const parts: string[] = [];
  if (args.route?.car)
    parts.push(`차로 ${fmtDuration(args.route.car.durationMin)}`);
  if (args.route?.walk)
    parts.push(`도보 ${fmtDuration(args.route.walk.durationMin)}`);
  return parts.length ? parts.join("  ") : "-";
}

export default function PracticeAgencyPage() {
  const [supabase] = useState(createClient);

  const [mode, setMode] = useState<"교육원" | "현장실습기관">("교육원");
  const [region, setRegion] = useState("");
  const [subregion, setSubregion] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [centers, setCenters] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [sortMode, setSortMode] = useState<"default" | "distance">("default");
  // 선택한 곳까지 자동차·도보 소요시간 (내 위치 설정 시에만)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  // 학생 검색 → 집 주소를 출발지로
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentHit[]>([]);
  const [studentOpen, setStudentOpen] = useState(false);
  const [studentBusy, setStudentBusy] = useState(false);
  // 선택된 학생 + 간이 DB 팝업
  const [selectedStudent, setSelectedStudent] = useState<StudentHit | null>(
    null,
  );
  const [studentModal, setStudentModal] = useState(false);
  // 실습학생 DB 목록 팝업 (이름 몰라도 목록에서 찾기)
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseList, setBrowseList] = useState<StudentHit[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const { locationState, geocodeAddress, setCoords, clearLocation } =
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
    query.limit(300).then(({ data }) => {
      setCenters(data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, subregion, mode, hasSearched]);

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

  // 지도 마커 — 현재 위치 기준 가까운 순으로, 기관은 50개·교육원은 150개까지만
  const markerCap = mode === "현장실습기관" ? 50 : 150;
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

  // 소요시간 캐시 — 같은 (출발지 + 기관) 조합은 재호출 없이 재사용 (API 절약)
  const routeCache = useRef<Map<string, RouteInfo>>(new Map());

  // 선택 변경 시 자동차·도보 소요시간 조회 (내 위치가 있을 때만)
  const coords = locationState.coords;
  useEffect(() => {
    if (selected == null || !coords) {
      setRouteInfo(null);
      return;
    }
    const item = list.find((r) => r.id === selected);
    if (!item || item.latitude == null || item.longitude == null) {
      setRouteInfo(null);
      return;
    }
    // 캐시 키 = 출발지 좌표(소수 5자리) + 기관 id
    const cacheKey = `${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}|${item.id}`;
    const cached = routeCache.current.get(cacheKey);
    if (cached) {
      setRouteLoading(false);
      setRouteInfo(cached);
      return; // 캐시 적중 → API 호출 안 함
    }
    let cancelled = false;
    setRouteLoading(true);
    setRouteInfo(null);
    const params = new URLSearchParams({
      sx: String(coords.longitude),
      sy: String(coords.latitude),
      gx: String(item.longitude),
      gy: String(item.latitude),
    });
    fetch(`/api/directions?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RouteInfo | null) => {
        if (cancelled) return;
        if (d) routeCache.current.set(cacheKey, d);
        setRouteInfo(d);
      })
      .catch(() => {
        if (!cancelled) setRouteInfo(null);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, coords?.latitude, coords?.longitude]);

  // 학생 검색 (디바운스) — 이름/연락처/주소
  const skipNextStudentSearch = useRef(false);
  useEffect(() => {
    if (skipNextStudentSearch.current) {
      skipNextStudentSearch.current = false;
      return;
    }
    const q = studentQuery.trim();
    if (q.length < 1) {
      setStudentResults([]);
      setStudentOpen(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/practice-applicants/search?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as StudentHit[];
        if (!cancelled) {
          setStudentResults(data);
          setStudentOpen(true);
        }
      } catch {
        /* 무시 */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [studentQuery]);

  // 실습학생 DB 목록 팝업 — 검색어 없으면 최근 목록, 있으면 필터 (디바운스)
  useEffect(() => {
    if (!browseOpen) return;
    let cancelled = false;
    setBrowseLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/practice-applicants/search?q=${encodeURIComponent(browseQuery.trim())}&limit=50`,
        );
        const data = res.ok ? ((await res.json()) as StudentHit[]) : [];
        if (!cancelled) setBrowseList(data);
      } catch {
        if (!cancelled) setBrowseList([]);
      } finally {
        if (!cancelled) setBrowseLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [browseOpen, browseQuery]);

  // 학생 선택 → 집 주소 지오코딩 → 출발지 설정 + 거리순 자동 정렬
  const pickStudent = async (s: StudentHit) => {
    setStudentOpen(false);
    setBrowseOpen(false);
    skipNextStudentSearch.current = true;
    setStudentQuery(s.name ?? "");
    setSelectedStudent(s);
    setStudentModal(true); // 선택 즉시 간이 DB 팝업
    if (!s.address) return;
    setStudentBusy(true);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: s.address }),
      });
      const data = await res.json();
      if (res.ok && data.latitude != null) {
        setCoords(data.latitude, data.longitude, `${s.name ?? "학생"} 학생 집`);
        setSortMode("distance");
      } else {
        alert(
          `'${s.name ?? "학생"}' 주소를 좌표로 변환하지 못했습니다.\n주소: ${s.address}`,
        );
      }
    } catch {
      alert("주소 변환 중 오류가 발생했습니다.");
    } finally {
      setStudentBusy(false);
    }
  };

  const onRegion = (v: string) => {
    setRegion(v);
    setSubregion("");
    setHasSearched(true);
  };
  const onSubregion = (v: string) => {
    setSubregion(v);
    setHasSearched(true);
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

          {/* 출발지 설정 — 내 위치(GPS) 또는 주소 직접 지정. 거리·소요시간의 기준점 */}
          <div className={styles.locGroup}>
            <div className={styles.locTitle}>
              출발지{" "}
              <span className={styles.locHint}>
                (여기 기준으로 소요시간 계산)
              </span>
            </div>

            {/* 학생 검색 → 집 주소를 출발지로 (검색칸 + 정보보기 한 줄) */}
            <div className={styles.stuSearch}>
              <div className={styles.stuRow}>
                <div className={styles.searchField}>
                  <span className={styles.searchIcon}>
                    <SearchIcon />
                  </span>
                  <input
                    className={styles.locInput}
                    placeholder="학생 이름·연락처로 검색"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    onFocus={() => {
                      if (studentResults.length) setStudentOpen(true);
                    }}
                    onBlur={() => setTimeout(() => setStudentOpen(false), 150)}
                  />
                </div>
                <button
                  type="button"
                  className={styles.locSearch}
                  onClick={() => {
                    setBrowseQuery("");
                    setBrowseOpen(true);
                  }}
                >
                  찾기
                </button>
              </div>
              {studentBusy && (
                <span className={styles.stuBusy}>주소 변환 중…</span>
              )}
              {studentOpen && studentResults.length > 0 && (
                <ul className={styles.stuList}>
                  {studentResults.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={styles.stuItem}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickStudent(s)}
                      >
                        <span className={styles.stuName}>
                          {s.name || "(이름없음)"}
                        </span>
                        <span className={styles.stuAddr}>
                          {s.address || "주소 없음"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {studentOpen &&
                studentQuery.trim().length >= 1 &&
                studentResults.length === 0 &&
                !studentBusy && (
                  <div className={styles.stuEmpty}>검색 결과가 없어요</div>
                )}
            </div>

            <div className={styles.locRow}>
              <div className={styles.searchField}>
                <span className={styles.searchIcon}>
                  <SearchIcon />
                </span>
                <input
                  className={styles.locInput}
                  placeholder="출발지 주소 직접 입력"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addressInput.trim())
                      geocodeAddress(addressInput.trim());
                  }}
                />
              </div>
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
                <b>출발지: {locationState.addressText}</b>
                {selectedStudent && (
                  <button
                    type="button"
                    className={styles.stuInfoBtn}
                    onClick={() => setStudentModal(true)}
                  >
                    정보
                  </button>
                )}
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
                    <div className={styles.cardHead}>
                      <span className={styles.cardType}>
                        {it.category || "교육원"}
                      </span>
                      <span className={styles.cardName}>
                        {it.institute_name}
                      </span>
                    </div>
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
                      <span
                        className={styles.fieldValueEllipsis}
                        title={it.address || undefined}
                      >
                        {it.address || "-"}
                      </span>
                    </div>
                  </div>
                  {it.note && (
                    <div className={styles.noteBox}>
                      <b>비고</b> · {it.note}
                    </div>
                  )}
                  <div className={styles.etaRow}>
                    <span className={styles.etaLabel}>걸리는 시간 :</span>
                    <span className={styles.etaValue}>
                      {etaDisplay({
                        active: sel && !!coords,
                        loading: routeLoading,
                        route: routeInfo,
                      })}
                    </span>
                  </div>
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
                    <div className={styles.cardHead}>
                      <span className={styles.cardType}>
                        {it.institution_type || "기관"}
                      </span>
                      <span className={styles.cardName}>{it.name}</span>
                    </div>
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
                      <span
                        className={styles.fieldValueEllipsis}
                        title={it.full_address || undefined}
                      >
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
                  <div className={styles.etaRow}>
                    <span className={styles.etaLabel}>걸리는 시간 :</span>
                    <span className={styles.etaValue}>
                      {etaDisplay({
                        active: sel && !!coords,
                        loading: routeLoading,
                        route: routeInfo,
                      })}
                    </span>
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
          routeInfo={routeInfo}
          routeLoading={routeLoading}
        />
      </div>

      {/* 실습학생 DB 목록 팝업 — 이름 몰라도 목록에서 찾아 선택 */}
      {browseOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setBrowseOpen(false)}
        >
          <div
            className={`${styles.modalCard} ${styles.browseCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>실습학생 DB</div>
                <div className={styles.modalSub}>
                  학생을 누르면 집 주소가 출발지로 설정됩니다
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setBrowseOpen(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className={styles.browseBody}>
              <div className={styles.searchField}>
                <span className={styles.searchIcon}>
                  <SearchIcon />
                </span>
                <input
                  className={styles.locInput}
                  placeholder="이름·연락처·주소로 검색"
                  value={browseQuery}
                  onChange={(e) => setBrowseQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.browseList}>
                {browseLoading ? (
                  <div className={styles.browseEmpty}>불러오는 중…</div>
                ) : browseList.length === 0 ? (
                  <div className={styles.browseEmpty}>결과가 없어요</div>
                ) : (
                  browseList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.browseItem}
                      onClick={() => pickStudent(s)}
                    >
                      <span className={styles.browseName}>
                        {s.name || "(이름없음)"}
                        {s.contact && (
                          <span className={styles.browseContact}>
                            {s.contact}
                          </span>
                        )}
                      </span>
                      <span className={styles.browseMeta}>
                        {s.address || "주소 없음"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 간이 실습학생 DB 팝업 — 페이지 이동 없이 학생 정보 확인 */}
      {studentModal && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={() => setStudentModal(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  {selectedStudent.name || "학생"}
                </div>
                <div className={styles.modalSub}>실습학생 DB · 간이 조회</div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setStudentModal(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              {(
                [
                  ["연락처", selectedStudent.contact],
                  ["생년월일", selectedStudent.birth_date],
                  ["성별", selectedStudent.gender],
                  ["집 주소", selectedStudent.address],
                  ["상태", selectedStudent.status],
                  ["실습종류", selectedStudent.practice_type],
                  ["희망 실습일", selectedStudent.desired_date],
                  ["희망 요일", selectedStudent.desired_weekday],
                  ["희망 학기", selectedStudent.desired_semester],
                  ["인정기간", selectedStudent.recognition_period],
                  ["실습 교육원", selectedStudent.training_center],
                  ["현장실습기관", selectedStudent.field_institution],
                  ["자차", selectedStudent.own_car],
                  ["담당자", selectedStudent.manager],
                ] as [string, string | null | undefined][]
              ).map(([label, value]) => (
                <div className={styles.modalRow} key={label}>
                  <span className={styles.modalLabel}>{label}</span>
                  <span className={styles.modalValue}>{value || "-"}</span>
                </div>
              ))}
              {selectedStudent.counsel_content && (
                <div className={styles.modalNote}>
                  <div className={styles.modalLabel}>상담내용</div>
                  <div className={styles.modalNoteText}>
                    {selectedStudent.counsel_content}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
