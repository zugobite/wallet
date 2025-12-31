/**
 * Role-Based Access Control Middleware
 * Restricts access to routes based on user roles
 */

/**
 * Create middleware that requires specific roles
 * @param {...string} allowedRoles - Roles that are allowed access
 * @returns {Function} Express middleware
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        code: "UNAUTHORIZED",
        error: "Authentication required",
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        status: 403,
        code: "FORBIDDEN",
        error: "Insufficient permissions",
      });
    }

    next();
  };
}

/**
 * Middleware that requires ADMIN role
 */
export const requireAdmin = requireRoles("ADMIN");

/**
 * Middleware that requires CUSTOMER role
 */
export const requireCustomer = requireRoles("CUSTOMER");

/**
 * Middleware that allows both ADMIN and CUSTOMER roles
 */
export const requireAuthenticated = requireRoles("ADMIN", "CUSTOMER");
