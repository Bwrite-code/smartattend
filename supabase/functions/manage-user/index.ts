// ═══════════════════════════════════════════════════════════════════════════
// SmartAttend — manage-user Edge Function (Deno)
//
// Privileged account operations that must never run in the browser.
// Called only by verified application admins.
//
// Actions:
//
//   create
//     {
//       action,
//       role,
//       email,
//       password?,
//       fullName,
//       phone?,
//       studentNumber? | staffNumber?,
//       departmentId?,
//       level?
//     }
//
//   update-email
//     { action, userId, email }
//
//   delete
//     { action, userId }
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  action: 'create' | 'update-email' | 'delete';

  role?: 'admin' | 'lecturer' | 'student';

  email?: string;
  password?: string;
  fullName?: string;
  phone?: string | null;

  userId?: string;

  studentNumber?: string;
  staffNumber?: string;

  departmentId?: string;
  level?: number;
}

Deno.serve(async (req) => {
  // ────────────────────────────────────────────────────────────────────────
  // CORS
  // ────────────────────────────────────────────────────────────────────────

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    // ──────────────────────────────────────────────────────────────────────
    // Environment
    // ──────────────────────────────────────────────────────────────────────

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return json(
        {
          ok: false,
          code: 'configuration',
          message: 'Supabase server configuration is missing.',
        },
        500,
      );
    }

    // Service-role client.
    // This key must NEVER be exposed to the browser.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ──────────────────────────────────────────────────────────────────────
    // 1. Verify caller
    // ──────────────────────────────────────────────────────────────────────

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return json(
        {
          ok: false,
          code: 'unauthenticated',
          message: 'Missing access token.',
        },
        401,
      );
    }

    const {
      data: userData,
      error: userErr,
    } = await admin.auth.getUser(token);

    if (userErr || !userData.user) {
      return json(
        {
          ok: false,
          code: 'unauthenticated',
          message: 'Invalid access token.',
        },
        401,
      );
    }

    const {
      data: callerProfile,
      error: profileError,
    } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      return json(
        {
          ok: false,
          code: 'profile_lookup_failed',
          message: profileError.message,
        },
        500,
      );
    }

    if (callerProfile?.role !== 'admin') {
      return json(
        {
          ok: false,
          code: 'permission',
          message: 'Only administrators can manage users.',
        },
        403,
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Parse request
    // ──────────────────────────────────────────────────────────────────────

    const body = (await req.json()) as Payload;

    // ══════════════════════════════════════════════════════════════════════
    // CREATE
    // ══════════════════════════════════════════════════════════════════════

    if (body.action === 'create') {
      const role = body.role;
      const email = body.email?.trim().toLowerCase();
      const fullName = body.fullName?.trim();

      if (!role || !email || !fullName) {
        return json(
          {
            ok: false,
            code: 'validation',
            message: 'role, email and fullName are required.',
          },
          400,
        );
      }

      if (!['admin', 'lecturer', 'student'].includes(role)) {
        return json(
          {
            ok: false,
            code: 'validation',
            message: 'Invalid user role.',
          },
          400,
        );
      }

      // ────────────────────────────────────────────────────────────────────
      // Create Supabase Auth user
      // ────────────────────────────────────────────────────────────────────

      const {
        data: created,
        error: createErr,
      } = await admin.auth.admin.createUser({
        email,
        password: body.password || generateTempPassword(),
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone: body.phone ?? null,
        },
      });

      if (createErr || !created.user) {
        const msg =
          createErr?.message ?? 'Could not create the user.';

        const duplicateEmail =
          /already|duplicate|exists/i.test(msg);

        return json(
          {
            ok: false,
            code: duplicateEmail
              ? 'duplicate_email'
              : 'auth_creation_failed',
            message: duplicateEmail
              ? 'A user with this email already exists.'
              : msg,
          },
          duplicateEmail ? 409 : 400,
        );
      }

      const userId = created.user.id;

      // ────────────────────────────────────────────────────────────────────
      // Update profile created by the Auth signup trigger
      // ────────────────────────────────────────────────────────────────────

      const {
        error: profileUpdateError,
      } = await admin
        .from('profiles')
        .update({
          role,
          phone: body.phone ?? null,
          email,
          full_name: fullName,
        })
        .eq('id', userId);

      if (profileUpdateError) {
        await admin.auth.admin.deleteUser(userId);

        return json(
          {
            ok: false,
            code: 'profile_update_failed',
            message: profileUpdateError.message,
          },
          400,
        );
      }

      // ════════════════════════════════════════════════════════════════════
      // STUDENT
      // ════════════════════════════════════════════════════════════════════

      if (role === 'student') {
        if (!body.studentNumber?.trim()) {
          await admin.auth.admin.deleteUser(userId);

          return json(
            {
              ok: false,
              code: 'validation',
              message: 'studentNumber is required.',
            },
            400,
          );
        }

        const {
          data: student,
          error: studentError,
        } = await admin
          .from('students')
          .insert({
            profile_id: userId,
            student_number: body.studentNumber.trim().toUpperCase(),
            department_id: body.departmentId ?? null,
            level: body.level ?? 100,
          })
          .select('id')
          .single();

        if (studentError || !student) {
          await admin.auth.admin.deleteUser(userId);

          return json(
            {
              ok: false,
              code: getDatabaseErrorCode(studentError?.message),
              message:
                studentError?.message ??
                'Could not create the student record.',
            },
            getDatabaseErrorStatus(studentError?.message),
          );
        }

        // IMPORTANT:
        // Return students.id, not the Auth/profile UUID.
        return json({
          ok: true,
          student_id: student.id,
          profile_id: userId,
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // LECTURER
      // ════════════════════════════════════════════════════════════════════

      if (role === 'lecturer') {
        if (!body.staffNumber?.trim()) {
          await admin.auth.admin.deleteUser(userId);

          return json(
            {
              ok: false,
              code: 'validation',
              message: 'staffNumber is required.',
            },
            400,
          );
        }

        const {
          data: lecturer,
          error: lecturerError,
        } = await admin
          .from('lecturers')
          .insert({
            profile_id: userId,
            staff_number: body.staffNumber.trim().toUpperCase(),
            department_id: body.departmentId ?? null,
          })
          .select('id')
          .single();

        if (lecturerError || !lecturer) {
          await admin.auth.admin.deleteUser(userId);

          return json(
            {
              ok: false,
              code: getDatabaseErrorCode(lecturerError?.message),
              message:
                lecturerError?.message ??
                'Could not create the lecturer record.',
            },
            getDatabaseErrorStatus(lecturerError?.message),
          );
        }

        // IMPORTANT:
        // Return lecturers.id, not the Auth/profile UUID.
        return json({
          ok: true,
          lecturer_id: lecturer.id,
          profile_id: userId,
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // ADMIN
      // ════════════════════════════════════════════════════════════════════

      if (role === 'admin') {
        // Admin users do not have a separate admin table in the current
        // schema. The profile UUID is therefore the admin identifier.
        return json({
          ok: true,
          admin_id: userId,
          profile_id: userId,
        });
      }

      return json(
        {
          ok: false,
          code: 'validation',
          message: 'Unsupported user role.',
        },
        400,
      );
    }

    // ══════════════════════════════════════════════════════════════════════
    // UPDATE EMAIL
    // ══════════════════════════════════════════════════════════════════════

    if (body.action === 'update-email') {
      if (!body.userId || !body.email?.trim()) {
        return json(
          {
            ok: false,
            code: 'validation',
            message: 'userId and email are required.',
          },
          400,
        );
      }

      const email = body.email.trim().toLowerCase();

      const {
        error: authError,
      } = await admin.auth.admin.updateUserById(
        body.userId,
        {
          email,
        },
      );

      if (authError) {
        const duplicateEmail =
          /already|duplicate|exists/i.test(authError.message);

        return json(
          {
            ok: false,
            code: duplicateEmail
              ? 'duplicate_email'
              : 'email_update_failed',
            message: duplicateEmail
              ? 'A user with this email already exists.'
              : authError.message,
          },
          duplicateEmail ? 409 : 400,
        );
      }

      const {
        error: profileUpdateError,
      } = await admin
        .from('profiles')
        .update({
          email,
        })
        .eq('id', body.userId);

      if (profileUpdateError) {
        return json(
          {
            ok: false,
            code: 'profile_update_failed',
            message: profileUpdateError.message,
          },
          400,
        );
      }

      return json({
        ok: true,
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // DELETE
    // ══════════════════════════════════════════════════════════════════════

    if (body.action === 'delete') {
      if (!body.userId) {
        return json(
          {
            ok: false,
            code: 'validation',
            message: 'userId is required.',
          },
          400,
        );
      }

      const {
        error: deleteError,
      } = await admin.auth.admin.deleteUser(body.userId);

      if (deleteError) {
        return json(
          {
            ok: false,
            code: 'delete_failed',
            message: deleteError.message,
          },
          400,
        );
      }

      // FK cascades should remove the associated profile and
      // student/lecturer records according to the database schema.
      return json({
        ok: true,
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // UNKNOWN ACTION
    // ══════════════════════════════════════════════════════════════════════

    return json(
      {
        ok: false,
        code: 'validation',
        message: 'Unknown action.',
      },
      400,
    );
  } catch (err) {
    return json(
      {
        ok: false,
        code: 'unknown',
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected error.',
      },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function json(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  );
}

function getDatabaseErrorCode(
  message?: string,
): string {
  if (!message) {
    return 'database_error';
  }

  if (/student_number/i.test(message)) {
    return 'duplicate_student_number';
  }

  if (/staff_number/i.test(message)) {
    return 'duplicate_staff_number';
  }

  if (/permission denied/i.test(message)) {
    return 'database_permission';
  }

  if (/foreign key|violates.*foreign/i.test(message)) {
    return 'invalid_reference';
  }

  if (/not-null|violates not-null/i.test(message)) {
    return 'missing_required_field';
  }

  return 'database_error';
}

function getDatabaseErrorStatus(
  message?: string,
): number {
  if (!message) {
    return 400;
  }

  if (
    /student_number|staff_number|duplicate|unique/i.test(
      message,
    )
  ) {
    return 409;
  }

  if (/permission denied/i.test(message)) {
    return 500;
  }

  return 400;
}

function generateTempPassword(): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

  let out = '';

  for (let i = 0; i < 12; i++) {
    out += chars[
      Math.floor(Math.random() * chars.length)
    ];
  }

  return out;
}