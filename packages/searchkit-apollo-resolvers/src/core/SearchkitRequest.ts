import dataloader from 'dataloader'
import fetch from 'node-fetch'
import { SearchResponse } from 'elasticsearch'
import { SearchkitConfig } from '../resolvers'
import QueryManager from './QueryManager'
import { filterTransform } from './FacetsFns'

export const mergeESQueries = (queries) =>
  queries.reduce(
    (combinedQuery, partial) => ({
      ...combinedQuery,
      ...partial,
      aggs: {
        ...combinedQuery.aggs,
        ...partial.aggs
      }
    }),
    {}
  )

export default class SearchkitRequest {
  private dataloader: any

  constructor(private queryManager: QueryManager, private config: SearchkitConfig) {
    this.dataloader = new dataloader(async (partialQueries) => {
      const baseQuery = {
        size: 0,
        ...(this.queryManager.hasQuery() && this.config.query
          ? { query: this.config.query.getFilter(this.queryManager) }
          : {}),
        post_filter: filterTransform(this.queryManager, this.config.facets)
      }

      const ESQuery = mergeESQueries([baseQuery, ...(partialQueries as any[])])
      const response = await this.executeQuery(ESQuery)
      return partialQueries.map(() => response)
    })
  }

  public async search(partialQuery): Promise<SearchResponse<any>> {
    return this.dataloader.load(partialQuery)
  }

  private async executeQuery(esQuery): Promise<SearchResponse<any>> {
    try {
      console.log({
        host: this.config.host,
        query: JSON.stringify(esQuery)
      })
      const response = await fetch(this.config.host, {
        body: JSON.stringify(esQuery),
        method: 'POST',
        headers: {
          'Content-Type': 'Application/json'
        }
      })
      const results = await response.json()
      return results
    } catch (e) {
      console.log(e)
    }
  }
}
