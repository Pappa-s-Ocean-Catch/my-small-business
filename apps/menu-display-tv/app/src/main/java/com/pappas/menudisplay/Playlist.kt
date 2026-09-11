package com.pappas.menudisplay

object Playlist {
    fun reconcile(ids: List<String>, available: Set<String>) = ids.filter { it in available }.distinct()
    fun next(index: Int, direction: Int, count: Int) = if (count == 0) 0 else Math.floorMod(index + direction, count)
}
