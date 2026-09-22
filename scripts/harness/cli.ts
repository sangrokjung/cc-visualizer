import { scanHarness, writeInventory } from './scan'

try {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    process.stdout.write('Usage: node harness-scanner.cjs [--project <absolute-directory>] [--output <inventory.json>]\nReads local harness metadata without executing tools. Defaults to JSON on stdout.\n')
  } else {
    let project: string | undefined
    let output: string | undefined
    for (let index = 0; index < args.length; index++) {
      const arg = args[index]
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('INVALID_ARGUMENTS')
      if (arg === '--project') project = value
      else if (arg === '--output') output = value
      else throw new Error('INVALID_ARGUMENTS')
    }
    const inventory = scanHarness({ project })
    if (output) writeInventory(output, inventory)
    else process.stdout.write(JSON.stringify(inventory))
  }
} catch {
  process.stderr.write('HARNESS_SCAN_FAILED: 입력 경로·출력 파일·읽기 권한을 확인하세요. 원문 오류는 표시하지 않습니다.\n')
  process.exitCode = 1
}
