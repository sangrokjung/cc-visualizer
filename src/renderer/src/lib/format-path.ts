// 홈 디렉토리 경로 단축 — PC/사용자 무관 (다른 직원 Mac에서도 동작)
//
// 절대 경로의 home prefix(`/Users/<user>/` 또는 `/home/<user>/`)를 `~/`로 치환한다.
// 특정 username(sangrok)을 하드코딩하지 않으므로 임의의 직원 PC에서 올바르게 동작.
// `~`로 시작하는 경로·home 외부 경로는 그대로 통과시킨다.
export function shortenHomePath(p: string): string {
  if (!p) return p
  // /Users/<user>/... 또는 /home/<user>/... → ~/...
  // [^/]+ 는 username 한 세그먼트만 매칭, 이어지는 / 가 있어야 home 하위로 인정
  // (루트 `/Users/<user>` 자체는 하위 세그먼트가 없으므로 미치환).
  return p.replace(/^\/(?:Users|home)\/[^/]+\//, '~/')
}
