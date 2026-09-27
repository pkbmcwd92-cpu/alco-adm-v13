import {
  CalendarSearchRequest,
  CalendarProviderResolution,
} from './calendarProvider';

/**
 * Resolves academic calendar online via backend GroundedCalendarSearchProvider endpoint (/api/calendar/resolve).
 * Fail-closed: returns UNRESOLVED status with empty candidates if network fails, invalid arguments, or server error.
 */
export async function resolveCalendarOnline(
  request: CalendarSearchRequest
): Promise<CalendarProviderResolution> {
  // Fail closed argument validation
  if (
    !request ||
    typeof request.academicYear !== 'string' ||
    request.academicYear.trim() === ''
  ) {
    return {
      status: 'UNRESOLVED',
      candidates: [],
      message: 'Parameter permintaan kalender tidak valid (academicYear wajib diisi).',
    };
  }

  try {
    const response = await fetch('/api/calendar/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        academicYear: request.academicYear.trim(),
        province: typeof request.province === 'string' && request.province.trim() ? request.province.trim() : undefined,
        regency: typeof request.regency === 'string' && request.regency.trim() ? request.regency.trim() : undefined,
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      let errDiag = undefined;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
        if (errJson && errJson.resolution && errJson.resolution.diagnostic) {
          errDiag = errJson.resolution.diagnostic;
        }
      } catch {
        // ignore JSON parse error on non-OK response
      }
      return {
        status: 'UNRESOLVED',
        candidates: [],
        message: `Gagal menghubungi layanan kalender pendidikan: ${errorMsg}`,
        diagnostic: errDiag || {
          aiConfigured: true,
          reason: 'MODEL_FAILURE',
          stages: [],
        },
      };
    }

    const data = await response.json();
    const rawStatus = data?.resolution?.status;
    const isValidStatus =
      rawStatus === 'RESOLVED' ||
      rawStatus === 'PARTIALLY_RESOLVED' ||
      rawStatus === 'UNRESOLVED';

    if (data && data.success && data.resolution && isValidStatus) {
      return {
        status: rawStatus,
        selectedSource: data.resolution.selectedSource,
        candidates: Array.isArray(data.resolution.candidates) ? data.resolution.candidates : [],
        resolvedLevel: data.resolution.resolvedLevel,
        message: data.resolution.message,
        diagnostic: data.resolution.diagnostic,
      };
    }

    return {
      status: 'UNRESOLVED',
      candidates: [],
      message: 'Format respons resolusi kalender dari server tidak valid.',
    };
  } catch (error: any) {
    return {
      status: 'UNRESOLVED',
      candidates: [],
      message: error?.message || 'Gagal menghubungi server untuk resolusi kalender pendidikan.',
      diagnostic: {
        aiConfigured: true,
        reason: 'MODEL_FAILURE',
        stages: [],
      },
    };
  }
}
