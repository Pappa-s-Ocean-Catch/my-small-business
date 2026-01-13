'use client';

import { useState, useEffect } from 'react';
import { OrderHeader } from '@/components/OrderHeader';
import { getUserRewardPoints, getUserRewardPointTransactions, getRewardPointsSettings } from '@/app/actions/reward-points';
import type { UserRewardPoints, RewardPointTransaction } from '@/app/actions/reward-points';
import { FaGift, FaArrowUp, FaArrowDown, FaClock, FaShoppingCart } from 'react-icons/fa';
import Link from 'next/link';

export default function RewardsPage() {
  const [userPoints, setUserPoints] = useState<UserRewardPoints | null>(null);
  const [transactions, setTransactions] = useState<RewardPointTransaction[]>([]);
  const [settings, setSettings] = useState({ dollars_per_point: 0.001 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pointsResult, transactionsResult, settingsResult] = await Promise.all([
        getUserRewardPoints(),
        getUserRewardPointTransactions(100),
        getRewardPointsSettings(),
      ]);

      if (pointsResult.data) {
        setUserPoints(pointsResult.data);
      }

      if (transactionsResult.data) {
        setTransactions(transactionsResult.data);
      }

      if (settingsResult) {
        setSettings(settingsResult);
      }
    } catch (error) {
      console.error('Error loading reward points:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDollarValue = (points: number) => {
    return (points * settings.dollars_per_point).toFixed(2);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned':
        return <FaArrowUp className="w-5 h-5 text-green-600" />;
      case 'used':
        return <FaArrowDown className="w-5 h-5 text-red-600" />;
      case 'expired':
        return <FaClock className="w-5 h-5 text-gray-600" />;
      default:
        return <FaGift className="w-5 h-5 text-blue-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned':
        return 'text-green-600 dark:text-green-400';
      case 'used':
        return 'text-red-600 dark:text-red-400';
      case 'expired':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading reward points...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <OrderHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FaGift className="text-yellow-500" />
            My Reward Points
          </h1>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-yellow-100 text-sm mb-1">Current Balance</p>
              <h2 className="text-4xl font-bold">
                {userPoints?.current_balance.toLocaleString() || 0} Points
              </h2>
            </div>
            <FaGift className="w-16 h-16 text-yellow-200 opacity-50" />
          </div>
          <div className="border-t border-yellow-300 pt-4">
            <p className="text-yellow-100 text-sm">
              Worth approximately <span className="font-bold text-lg">${getDollarValue(userPoints?.current_balance || 0)}</span>
            </p>
            <p className="text-yellow-200 text-xs mt-1">
              Use your points at checkout to save money!
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <FaArrowUp className="w-5 h-5 text-green-600" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Earned</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {userPoints?.total_points_earned.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              ${getDollarValue(userPoints?.total_points_earned || 0)} value
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <FaArrowDown className="w-5 h-5 text-red-600" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Used</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {userPoints?.total_points_used.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              ${getDollarValue(userPoints?.total_points_used || 0)} saved
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <FaShoppingCart className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Available</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {userPoints?.current_balance.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Ready to use
            </p>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Transaction History
          </h2>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <FaGift className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">No transactions yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Start earning points by placing orders!
              </p>
              <Link
                href="/order"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <FaShoppingCart className="w-4 h-4" />
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start gap-4 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getTransactionIcon(transaction.transaction_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description || `${transaction.transaction_type} points`}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                        {transaction.order_id && (
                          <Link
                            href={`/order/history`}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                          >
                            View Order
                          </Link>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${getTransactionColor(transaction.transaction_type)}`}>
                          {transaction.transaction_type === 'earned' ? '+' : ''}
                          {transaction.points.toLocaleString()} pts
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Balance: {transaction.points_balance_after.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            How Reward Points Work
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Earn points automatically when you pay for orders</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Use your points at checkout to reduce your order total</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>You can use partial points - pay the rest with your card</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Points never expire and can be used anytime</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
