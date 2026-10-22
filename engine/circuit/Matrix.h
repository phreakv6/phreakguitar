#pragma once

#include <cmath>
#include <utility>
#include <vector>

namespace phreak::circuit
{

/** Small dense row-major matrix of doubles. Sized at build time (off the
    sample loop); the per-sample code only reads/writes existing storage. */
class Matrix
{
public:
    Matrix() = default;
    Matrix (int r, int c) : rows (r), cols (c), d ((size_t) (r * c), 0.0) {}

    double& operator() (int r, int c)       { return d[(size_t) (r * cols + c)]; }
    double operator() (int r, int c) const  { return d[(size_t) (r * cols + c)]; }

    int rows = 0, cols = 0;
    std::vector<double> d;
};

inline Matrix multiply (const Matrix& a, const Matrix& b)
{
    Matrix m (a.rows, b.cols);
    for (int i = 0; i < a.rows; ++i)
        for (int k = 0; k < a.cols; ++k)
        {
            const double v = a (i, k);
            if (v == 0.0)
                continue;
            for (int j = 0; j < b.cols; ++j)
                m (i, j) += v * b (k, j);
        }
    return m;
}

inline Matrix transpose (const Matrix& a)
{
    Matrix t (a.cols, a.rows);
    for (int i = 0; i < a.rows; ++i)
        for (int j = 0; j < a.cols; ++j)
            t (j, i) = a (i, j);
    return t;
}

/** In-place LU factorisation with partial pivoting, then solves for any
    number of right-hand sides. Returns false if (numerically) singular. */
class LU
{
public:
    bool factor (Matrix m)
    {
        n = m.rows;
        lu = std::move (m);
        perm.resize ((size_t) n);
        for (int i = 0; i < n; ++i)
            perm[(size_t) i] = i;

        for (int k = 0; k < n; ++k)
        {
            int p = k;
            for (int i = k + 1; i < n; ++i)
                if (std::abs (lu (i, k)) > std::abs (lu (p, k)))
                    p = i;
            if (std::abs (lu (p, k)) < 1e-300)
                return false;
            if (p != k)
            {
                for (int j = 0; j < n; ++j)
                    std::swap (lu (k, j), lu (p, j));
                std::swap (perm[(size_t) k], perm[(size_t) p]);
            }
            for (int i = k + 1; i < n; ++i)
            {
                lu (i, k) /= lu (k, k);
                const double f = lu (i, k);
                if (f != 0.0)
                    for (int j = k + 1; j < n; ++j)
                        lu (i, j) -= f * lu (k, j);
            }
        }
        return true;
    }

    /** Solves A X = B column by column. */
    Matrix solve (const Matrix& b) const
    {
        Matrix x (n, b.cols);
        std::vector<double> y ((size_t) n);
        for (int c = 0; c < b.cols; ++c)
        {
            for (int i = 0; i < n; ++i)
            {
                double s = b (perm[(size_t) i], c);
                for (int j = 0; j < i; ++j)
                    s -= lu (i, j) * y[(size_t) j];
                y[(size_t) i] = s;
            }
            for (int i = n - 1; i >= 0; --i)
            {
                double s = y[(size_t) i];
                for (int j = i + 1; j < n; ++j)
                    s -= lu (i, j) * x (j, c);
                x (i, c) = s / lu (i, i);
            }
        }
        return x;
    }

private:
    int n = 0;
    Matrix lu;
    std::vector<int> perm;
};

/** Gaussian elimination with partial pivoting on a tiny system, in place,
    no allocation (for the per-sample Newton step). a is n x n row-major,
    b has n entries and receives the solution. Returns false if singular. */
inline bool solveSmall (double* a, double* b, int n)
{
    for (int k = 0; k < n; ++k)
    {
        int p = k;
        for (int i = k + 1; i < n; ++i)
            if (std::abs (a[i * n + k]) > std::abs (a[p * n + k]))
                p = i;
        if (std::abs (a[p * n + k]) < 1e-300)
            return false;
        if (p != k)
        {
            for (int j = 0; j < n; ++j)
                std::swap (a[k * n + j], a[p * n + j]);
            std::swap (b[k], b[p]);
        }
        for (int i = k + 1; i < n; ++i)
        {
            const double f = a[i * n + k] / a[k * n + k];
            for (int j = k; j < n; ++j)
                a[i * n + j] -= f * a[k * n + j];
            b[i] -= f * b[k];
        }
    }
    for (int i = n - 1; i >= 0; --i)
    {
        double s = b[i];
        for (int j = i + 1; j < n; ++j)
            s -= a[i * n + j] * b[j];
        b[i] = s / a[i * n + i];
    }
    return true;
}

} // namespace phreak::circuit
