import { Injectable } from '@angular/core'
import { PaperlessDocument } from 'src/app/data/paperless-document'
import { PaperlessDocumentMetadata } from 'src/app/data/paperless-document-metadata'
import { AbstractPaperlessService } from './abstract-paperless-service'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs'
import { Results } from 'src/app/data/results'
import { FilterRule } from 'src/app/data/filter-rule'
import { map, tap } from 'rxjs/operators'
import { CorrespondentService } from './correspondent.service'
import { DocumentTypeService } from './document-type.service'
import { TagService } from './tag.service'
import { PaperlessDocumentSuggestions } from 'src/app/data/paperless-document-suggestions'
import { queryParamsFromFilterRules } from '../../utils/query-params'
import { StoragePathService } from './storage-path.service'

export const DOCUMENT_SORT_FIELDS = [
  { field: 'archive_serial_number', name: $localize`ASN` },
  { field: 'correspondent__name', name: $localize`Correspondent` },
  { field: 'title', name: $localize`Title` },
  { field: 'document_type__name', name: $localize`Document type` },
  { field: 'created', name: $localize`Created` },
  { field: 'added', name: $localize`Added` },
  { field: 'modified', name: $localize`Modified` },
]

export const DOCUMENT_SORT_FIELDS_FULLTEXT = [
  ...DOCUMENT_SORT_FIELDS,
  {
    field: 'score',
    name: $localize`:Score is a value returned by the full text search engine and specifies how well a result matches the given query:Search score`,
  },
]

export interface SelectionDataItem {
  id: number
  document_count: number
}

export interface SelectionData {
  selected_storage_paths: SelectionDataItem[]
  selected_correspondents: SelectionDataItem[]
  selected_tags: SelectionDataItem[]
  selected_document_types: SelectionDataItem[]
}

@Injectable({
  providedIn: 'root',
})
export class DocumentService extends AbstractPaperlessService<PaperlessDocument> {
  private _searchQuery: string

  constructor(
    http: HttpClient,
    private correspondentService: CorrespondentService,
    private documentTypeService: DocumentTypeService,
    private tagService: TagService,
    private storagePathService: StoragePathService
  ) {
    super(http, 'documents')
  }

  addObservablesToDocument(doc: PaperlessDocument) {
    if (doc.correspondent) {
      doc.correspondent$ = this.correspondentService.getCached(
        doc.correspondent
      )
    }
    if (doc.document_type) {
      doc.document_type$ = this.documentTypeService.getCached(doc.document_type)
    }
    if (doc.tags) {
      doc.tags$ = this.tagService
        .getCachedMany(doc.tags)
        .pipe(
          tap((tags) =>
            tags.sort((tagA, tagB) => tagA.name.localeCompare(tagB.name))
          )
        )
    }
    if (doc.storage_path) {
      doc.storage_path$ = this.storagePathService.getCached(doc.storage_path)
    }
    return doc
  }

  listFiltered(
    page?: number,
    pageSize?: number,
    sortField?: string,
    sortReverse?: boolean,
    filterRules?: FilterRule[],
    extraParams = {}
  ): Observable<Results<PaperlessDocument>> {
    return this.list(
      page,
      pageSize,
      sortField,
      sortReverse,
      Object.assign(extraParams, queryParamsFromFilterRules(filterRules))
    ).pipe(
      map((results) => {
        results.results.forEach((doc) => this.addObservablesToDocument(doc))
        return results
      })
    )
  }

  listAllFilteredIds(filterRules?: FilterRule[]): Observable<number[]> {
    return this.listFiltered(1, 100000, null, null, filterRules, {
      fields: 'id',
    }).pipe(map((response) => response.results.map((doc) => doc.id)))
  }

  getPreviewUrl(id: number, original: boolean = false): string {
    let url = this.getResourceUrl(id, 'preview')
    if (this._searchQuery) url += `#search="${this._searchQuery}"`
    if (original) {
      url += '?original=true'
    }
    return url
  }

  getGoogleDriveUrl(id: number, folder: string = 'MINUTES'): string{
    let url = this.getResourceUrl(id, 'googleDrive');
    if (folder){
      url += '?folder=' + folder;
    }
    return url;
  }

  getThumbUrl(id: number): string {
    return this.getResourceUrl(id, 'thumb')
  }

  getDownloadUrl(id: number, original: boolean = false): string {
    let url = this.getResourceUrl(id, 'download')
    if (original) {
      url += '?original=true'
    }
    return url
  }

  update(o: PaperlessDocument): Observable<PaperlessDocument> {
    // we want to only set created_date
    o.created = undefined
    return super.update(o)
  }

  uploadDocument(formData) {
    return this.http.post(
      this.getResourceUrl(null, 'post_document'),
      formData,
      { reportProgress: true, observe: 'events' }
    )
  }

  googleDriveShare(id: number, folder: string){
    return this.http.get(
      this.getGoogleDriveUrl(id,folder)
    )
  }

  getMetadata(id: number): Observable<PaperlessDocumentMetadata> {
    return this.http.get<PaperlessDocumentMetadata>(
      this.getResourceUrl(id, 'metadata')
    )
  }

  bulkEdit(ids: number[], method: string, args: any) {
    return this.http.post(this.getResourceUrl(null, 'bulk_edit'), {
      documents: ids,
      method: method,
      parameters: args,
    })
  }

  getSelectionData(ids: number[]): Observable<SelectionData> {
    return this.http.post<SelectionData>(
      this.getResourceUrl(null, 'selection_data'),
      { documents: ids }
    )
  }

  getSuggestions(id: number): Observable<PaperlessDocumentSuggestions> {
    return this.http.get<PaperlessDocumentSuggestions>(
      this.getResourceUrl(id, 'suggestions')
    )
  }

  bulkDownload(ids: number[], content = 'both') {
    return this.http.post(
      this.getResourceUrl(null, 'bulk_download'),
      { documents: ids, content: content },
      { responseType: 'blob' }
    )
  }

  public set searchQuery(query: string) {
    this._searchQuery = query
  }
}
